/**
 * Airi AI Engine — rule-based assistant
 * - Considers role (buyer/seller)
 * - Suggests price windows from numeric hints
 * - Detects town keywords
 * - Checks seller availability and backAt
 * - Suggests hotlist alternatives
 */
function aiReply({ question, mode, role, user, db, sellerId }) {
  const q = String(question || '').toLowerCase();
  let prefix = (mode === 'pro') ? 'Here is a structured insight: '
             : (mode === 'neon') ? '⚡ Neon scan → '
             : 'Hey 😊 ';

  // Detect town
  let town = user?.town || 'your area';
  ['nairobi', 'kiambu', 'mombasa', 'nakuru'].forEach(t => {
    if (q.includes(t)) town = t.charAt(0).toUpperCase() + t.slice(1);
  });

  // Detect price window
  const nums = q.match(/\d{3,7}/g);
  let priceMin = null, priceMax = null;
  if (nums && nums.length === 1) {
    const base = parseInt(nums[0], 10);
    priceMin = Math.round(base * 0.7);
    priceMax = Math.round(base * 1.3);
  } else if (nums && nums.length >= 2) {
    const sorted = nums.map(n=>parseInt(n,10)).filter(n=>!isNaN(n)).sort((a,b)=>a-b);
    priceMin = sorted[0]; priceMax = sorted[1];
  }

  // Commodity inference
  const solids = ['tv','chair','sofa','bed','lamp','fridge','groceries','ring light'];
  const virtuals = ['account','followers','instagram','tiktok','page','login'];
  let commodity = 'mixed';
  for (const w of solids) if (q.includes(w)) { commodity = 'solid'; break; }
  for (const w of virtuals) if (q.includes(w)) { commodity = 'virtual'; break; }

  // Availability check (if specific seller mentioned)
  let availabilityMsg = '';
  if (sellerId) {
    const seller = db.users.find(u => u.id === sellerId);
    if (seller && seller.availability) {
      const st = seller.availability.status || 'online';
      if (st === 'offline') {
        let back = 'later';
        if (seller.availability.backAt) {
          try {
            const dt = new Date(seller.availability.backAt);
            back = dt.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
          } catch {}
        }
        availabilityMsg = ` This seller is currently offline. Expected back at ${back}.`;
      } else if (st === 'busy') {
        availabilityMsg = ` This seller is currently busy. You can still leave a message or try similar items.`;
      } else {
        availabilityMsg = ` Seller is online now.`;
      }
    }
  }

  // Suggest alternatives from hotlist
  const alternatives = db.products
    .filter(p => p.availableNow && p.town.toLowerCase() === String(town).toLowerCase())
    .slice(0, 3);

  let suggestion = '';
  if (alternatives.length) {
    suggestion = ' Here are similar items nearby: ' + alternatives.map(p => {
      return `${p.title} (KES ${p.price})`;
    }).join(' • ') + '.';
  } else {
    suggestion = ' No nearby matches at the moment — try widening price range or switching town.';
  }

  let analysis = '';
  if (role === 'buyer') {
    analysis = `You are looking for a **${commodity}** in **${town}**.`;
    if (priceMin && priceMax) {
      analysis += ` A fair price window is **KES ${priceMin} – ${priceMax}**.`;
    } else {
      analysis += ` Add a number (e.g., "under 5000") for price guidance.`;
    }
    analysis += availabilityMsg + suggestion;
  } else {
    analysis = `For a **${commodity}** targeting **${town}**, craft a clear listing with 2 images, short bullets, and delivery/meetup details.`;
    if (priceMin && priceMax) {
      analysis += ` Consider pricing around **KES ${priceMin} – ${priceMax}**.`;
    } else {
      analysis += ` Add a price hint to calibrate pricing.`;
    }
    analysis += availabilityMsg + suggestion;
  }

  const displayName = (role === 'seller' && user?.storeName) ? user.storeName : (user?.name || 'friend');
  return { reply: `${prefix}${analysis} ${displayName ? '' : ''}`.trim() };
}

module.exports = { aiReply };
