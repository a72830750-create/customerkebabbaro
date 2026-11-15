// ===== FARID KEBAB - Ordering System =====

let cart = [];
function saveCart() { try { localStorage.setItem('faridkebab_cart', JSON.stringify(cart)); } catch(e) {} }

// DOM refs
const floatingCartBtn = document.getElementById('floating-cart-btn');
const floatingCartCount = document.getElementById('floating-cart-count');
const floatingCartTotal = document.getElementById('floating-cart-total');
const cartModal = document.getElementById('cart-modal');
const cartModalClose = document.getElementById('cart-modal-close');
const cartModalList = document.getElementById('cart-modal-list');
const cartModalSubtotal = document.getElementById('cart-modal-subtotal');
const cartModalCheckout = document.getElementById('cart-modal-checkout');
const orderModal = document.getElementById('order-modal');
const modalClose = document.getElementById('modal-close');
const modalDishName = document.getElementById('modal-dish-name');
const modalUnitPrice = document.getElementById('modal-unit-price');
const qtyInput = document.getElementById('qty-input');
const qtyMinus = document.getElementById('qty-minus');
const qtyPlus = document.getElementById('qty-plus');
const specialRequests = document.getElementById('special-requests');
const modalAdd = document.getElementById('modal-add');
const modalCancel = document.getElementById('modal-cancel');
const checkoutModal = document.getElementById('checkout-modal');
const checkoutClose = document.getElementById('checkout-close');
const checkoutBack = document.getElementById('checkout-back');
const checkoutSubmit = document.getElementById('checkout-submit');
const checkoutSummary = document.getElementById('checkout-summary');
const checkoutGrandTotal = document.getElementById('checkout-grand-total');
const checkoutStatus = document.getElementById('checkout-status');
const confirmModal = document.getElementById('confirm-modal');
const confirmOk = document.getElementById('confirm-ok');
const confirmTitle = document.getElementById('confirm-title');
const confirmMessage = document.getElementById('confirm-message');

let currentDish = null;

// ===== FCM Web Push (safe fallback if unsupported/denied) =====
var API_BASE_FCM = 'https://backend-1-osni.onrender.com';
var __fcmTokenCache = null;
var __fcmPermissionPromise = null;
var __fcmMessagingSwRegPromise = null;

function fcmLog() { try { console.log.apply(console, ['[FCM]'].concat([].slice.call(arguments))); } catch(e){} }
function fcmWarn() { try { console.warn.apply(console, ['[FCM]'].concat([].slice.call(arguments))); } catch(e){} }

function fcmSupported() {
  try { return !!(window.isSecureContext && 'Notification' in window && 'serviceWorker' in navigator && window.firebase && firebase.messaging && window.FIREBASE_CONFIG); } catch (e) { return false; }
}
function fcmConfigValid() {
  try {
    var c = window.FIREBASE_CONFIG || {};
    var ok = c.apiKey && String(c.apiKey).indexOf('REPLACE_') !== 0 && c.projectId && String(c.projectId).indexOf('REPLACE_') !== 0 && c.vapidKey && String(c.vapidKey).indexOf('REPLACE_') !== 0;
    if (!ok) fcmWarn('config invalid or placeholders present');
    return ok;
  } catch (e) { fcmWarn('config check error', e); return false; }
}
function ensureFcmInit() {
  if (!fcmSupported() || !fcmConfigValid()) { fcmWarn('init skipped', { supported: fcmSupported(), secure: window.isSecureContext }); return null; }
  try {
    if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
    if (!window.__fcmMessaging) window.__fcmMessaging = firebase.messaging();
    if (!window.__fcmOnMessageBound && window.__fcmMessaging && window.__fcmMessaging.onMessage) {
      window.__fcmOnMessageBound = true;
      window.__fcmMessaging.onMessage(function(payload){
        try{
          var n = (payload && payload.notification) || {};
          var d = (payload && payload.data) || {};
          var title = n.title || d.title || 'Aggiornamento ordine';
          var body = n.body || d.body || '';
          showOrderNotification(title, body, d.tag || ('order-' + (d.order_number || 'status')));
          try { if (typeof showMyOrder === 'function') showMyOrder(false); } catch(e){}
        }catch(e){ fcmWarn('onMessage handler error', e); }
      });
    }
    fcmLog('messaging ready');
    return window.__fcmMessaging;
  } catch (e) { fcmWarn('init error', e); return null; }
}
function getFcmMessagingSwReg() {
  if (window.__fcmSwReg) { fcmLog('using cached messaging SW reg', window.__fcmSwReg.scope); return Promise.resolve(window.__fcmSwReg); }
  if (window.__fcmSwReady) {
    return Promise.resolve(window.__fcmSwReady).then(function(r){
      if (r) { window.__fcmSwReg = r; fcmLog('using __fcmSwReady reg', r.scope); }
      return r || null;
    }).catch(function(e){ fcmWarn('sw ready error', e); return null; });
  }
  if (__fcmMessagingSwRegPromise) return __fcmMessagingSwRegPromise;
  if (!('serviceWorker' in navigator)) { fcmWarn('serviceWorker unsupported'); return Promise.resolve(null); }
  fcmLog('registering messaging SW fallback');
  __fcmMessagingSwRegPromise = navigator.serviceWorker.register('./firebase-messaging-sw.js', { scope: './firebase-cloud-messaging-push-scope/' }).then(function(reg){
    window.__fcmSwReg = reg; window.__fcmSwReady = Promise.resolve(reg);
    fcmLog('messaging SW registered (fallback)', reg && reg.scope);
    return reg;
  }).catch(function(e){ fcmWarn('messaging SW register error', e); return null; });
  return __fcmMessagingSwRegPromise;
}
function requestNotificationPermissionOnGesture() {
  try {
    if (!('Notification' in window)) { fcmWarn('Notification API unavailable'); return Promise.resolve('unsupported'); }
    var cur = Notification.permission;
    fcmLog('permission current', cur);
    if (cur === 'granted' || cur === 'denied') return Promise.resolve(cur);
    if (__fcmPermissionPromise) { fcmLog('permission request already in flight'); return __fcmPermissionPromise; }
    fcmLog('requesting notification permission (user gesture)');
    __fcmPermissionPromise = Notification.requestPermission().then(function(p){
      __fcmPermissionPromise = null;
      fcmLog('permission result', p);
      try { updateEnableNotificationsButton(); } catch(e){}
      return p;
    }).catch(function(e){
      __fcmPermissionPromise = null;
      fcmWarn('permission request error', e);
      return 'default';
    });
    return __fcmPermissionPromise;
  } catch(e){ fcmWarn('permission gesture error', e); return Promise.resolve('error'); }
}
// ===== Notification popup & iOS A2HS guide =====
var __notifPopupSessionDismissed = false;
var __notifPopupTimer = null;

function isIosDevice() {
  try {
    var ua = navigator.userAgent || '';
    var iOS = /iPad|iPhone|iPod/.test(ua);
    var iPadOS = (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return iOS || iPadOS;
  } catch(e){ return false; }
}
function isStandalonePwa() {
  try {
    return !!(window.navigator.standalone || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches));
  } catch(e){ return false; }
}
function iosA2hsGuideHtml() {
  return '' +
    '<div><strong>\uD83D\uDCF2 Vuoi ricevere notifiche sull\'ordine su iPhone? Aggiungi l\'app alla schermata Home:</strong></div>' +
    '<ul>' +
      '<li><strong>Safari:</strong> tocca l\'icona Condividi (\u2B06\uFE0F) nella barra in basso \u2192 scorri e tocca "Aggiungi a schermata Home" (\u2795) \u2192 "Aggiungi".</li>' +
      '<li><strong>Chrome:</strong> tocca l\'icona Condividi (\u2B06\uFE0F) in alto a destra accanto alla barra dell\'indirizzo (oppure apri il link in Safari) \u2192 "Aggiungi a schermata Home" (\u2795) \u2192 "Aggiungi".</li>' +
    '</ul>' +
    '<div class="ios-a2hs-footer">Poi apri l\'icona Farid Kebab dalla schermata Home per attivare le notifiche.</div>';
}
function isNotifPopupDismissed() {
  if (__notifPopupSessionDismissed) return true;
  try { return sessionStorage.getItem('notif_popup_dismissed') === '1'; } catch(e){ return false; }
}
function dismissNotifPopup() {
  __notifPopupSessionDismissed = true;
  try { sessionStorage.setItem('notif_popup_dismissed', '1'); } catch(e){}
  var popup = document.getElementById('notification-popup');
  if (popup) popup.style.display = 'none';
}
function shouldShowIosInstallGuide() {
  try { return isIosDevice() && !isStandalonePwa(); } catch(e){ return false; }
}
function shouldShowNotificationPopup() {
  try {
    if (isNotifPopupDismissed()) return false;
    if (('Notification' in window) && Notification.permission === 'granted') return false;
    if (shouldShowIosInstallGuide()) return true; // iOS browser: show tutorial
    // Android/Desktop/iOS standalone: show enable button when supported and not granted
    if (('Notification' in window) && window.isSecureContext && Notification.permission !== 'granted') return true;
    return false;
  } catch(e){ return false; }
}
function updateNotificationPopup() {
  try {
    var popup = document.getElementById('notification-popup');
    var btn = document.getElementById('enable-notifications-popup-btn');
    var guide = document.getElementById('notification-popup-ios-guide');
    var close = document.getElementById('notification-popup-close');
    if (!popup) return;
    if (close && !close._bound) { close._bound = true; close.addEventListener('click', function(){ dismissNotifPopup(); }); }

    // Auto-hide once granted
    if (('Notification' in window) && Notification.permission === 'granted') { popup.style.display = 'none'; return; }
    if (isNotifPopupDismissed()) { popup.style.display = 'none'; return; }

    var iosInstallGuide = shouldShowIosInstallGuide();
    var iosStandalone = isIosDevice() && isStandalonePwa();
    var supported = ('Notification' in window) && window.isSecureContext;

    if (guide) {
      if (iosInstallGuide) {
        if (!guide._rendered) { guide.innerHTML = iosA2hsGuideHtml(); guide._rendered = true; }
        guide.style.display = 'block';
      } else {
        guide.style.display = 'none';
      }
    }

    if (btn) {
      var showBtn = !iosInstallGuide && supported && Notification.permission !== 'granted';
      // iOS standalone: normal enable button; Android/Desktop: normal enable button
      btn.style.display = showBtn ? 'block' : 'none';
      btn.disabled = false;
      if (Notification.permission === 'denied') {
        btn.textContent = '🔔 Notifiche bloccate';
        btn.title = 'Abilita le notifiche dalle impostazioni del browser (Safari/Chrome)';
      } else {
        btn.textContent = '🔔 Attiva notifiche ordine';
        btn.title = '';
      }
      if (!btn._fcmBound) {
        btn._fcmBound = true;
        btn.addEventListener('click', function(){ enableOrderNotificationsFromGesture(); });
      }
    }

    // Keep visible state as-is if already shown; caller decides when to show
  } catch(e){ fcmWarn('updateNotificationPopup error', e); }
}
function showNotificationPopup(force) {
  try {
    updateNotificationPopup();
    if (!force && !shouldShowNotificationPopup()) return;
    var popup = document.getElementById('notification-popup');
    if (!popup) return;
    // if nothing to show inside, keep hidden
    var btn = document.getElementById('enable-notifications-popup-btn');
    var guide = document.getElementById('notification-popup-ios-guide');
    var hasContent = (btn && btn.style.display !== 'none') || (guide && guide.style.display !== 'none');
    if (!hasContent) { popup.style.display = 'none'; return; }
    popup.style.display = 'block';
  } catch(e){}
}
function scheduleNotificationPopup(delayMs) {
  try {
    if (__notifPopupTimer) { clearTimeout(__notifPopupTimer); __notifPopupTimer = null; }
    __notifPopupTimer = setTimeout(function(){ showNotificationPopup(false); }, typeof delayMs === 'number' ? delayMs : 2000);
  } catch(e){}
}

function updateEnableNotificationsButton() {
  try {
    var supported = ('Notification' in window) && window.isSecureContext;
    var show = supported && Notification.permission !== 'granted';
    var btns = [
      document.getElementById('enable-order-notifications-btn'),
      document.getElementById('enable-notifications-banner-btn'),
      document.getElementById('enable-notifications-popup-btn')
    ];
    btns.forEach(function(btn){
      if (!btn) return;
      var isPopup = btn.id === 'enable-notifications-popup-btn';
      if (!isPopup) btn.style.display = show ? 'inline-block' : 'none';
      btn.disabled = false;
      if (Notification.permission === 'denied') {
        btn.textContent = isPopup ? '🔔 Notifiche bloccate' : 'Notifiche bloccate';
        btn.title = 'Abilita le notifiche dalle impostazioni del browser (Safari/Chrome)';
      } else {
        btn.textContent = isPopup ? '🔔 Attiva notifiche ordine' : 'Attiva notifiche';
        btn.title = '';
      }
      if (!btn._fcmBound) {
        btn._fcmBound = true;
        btn.addEventListener('click', function(){ enableOrderNotificationsFromGesture(); });
      }
    });
    updateNotificationPopup();
  } catch(e){ fcmWarn('updateEnableNotificationsButton error', e); }
}
function enableOrderNotificationsFromGesture() {
  fcmLog('enable notifications button clicked');
  // Show popup context (guide on iOS browser) when relevant
  try { if (shouldShowIosInstallGuide()) showNotificationPopup(true); } catch(e){}
  if (!('Notification' in window)) { fcmWarn('Notification API unavailable'); return; }
  if (Notification.permission === 'denied') {
    try { alert('Notifiche bloccate. Abilitale dalle impostazioni del browser (Safari: Impostazioni sito, Chrome: icona lucchetto/notifiche).'); } catch(e){}
    updateEnableNotificationsButton();
    return;
  }
  requestNotificationPermissionOnGesture().then(function(perm){
    updateEnableNotificationsButton();
    if (perm === 'granted') {
      fcmLog('notifications enabled by user gesture');
      try { dismissNotifPopup(); } catch(e){}
      var num = null;
      try { num = localStorage.getItem('faridkebab_last_order'); } catch(e){}
      if (!num) { fcmWarn('no last order found for token registration (permission granted; will register on next order/tracking)'); return; }
      registerFcmTokenForOrder(num);
      return;
    }
    fcmWarn('permission not granted; token not registered', perm);
  }).catch(function(e){ fcmWarn('enable notifications flow error', e); });
}
function registerFcmTokenForOrder(orderNumber) {
  try {
    fcmLog('registerFcmTokenForOrder start', orderNumber);
    if (!orderNumber) { fcmWarn('no orderNumber'); return Promise.resolve(null); }
    if (!('Notification' in window)) { fcmWarn('Notification unsupported'); return Promise.resolve(null); }
    fcmLog('permission state', Notification.permission);
    if (Notification.permission === 'denied') { fcmWarn('permission denied'); updateEnableNotificationsButton(); return Promise.resolve(null); }
    if (Notification.permission !== 'granted') { fcmWarn('permission not granted yet'); updateEnableNotificationsButton(); return Promise.resolve(null); }
    var messaging = ensureFcmInit();
    if (!messaging) { fcmWarn('messaging unavailable'); return Promise.resolve(null); }
    return getFcmMessagingSwReg().then(function (reg) {
      fcmLog('SW registration for token', reg && reg.scope);
      if (!reg) { fcmWarn('no serviceWorkerRegistration for messaging'); return null; }
      try { if (messaging.useServiceWorker) messaging.useServiceWorker(reg); } catch (e) { fcmWarn('useServiceWorker error', e); }
      fcmLog('calling getToken');
      return messaging.getToken({ vapidKey: window.FIREBASE_CONFIG.vapidKey, serviceWorkerRegistration: reg });
    }).then(function (token) {
      fcmLog('getToken result', token ? ('token received len=' + token.length) : 'no token');
      if (!token) { fcmWarn('no FCM token received'); return null; }
      __fcmTokenCache = token;
      try { localStorage.setItem('faridkebab_fcm_token', token); } catch (e) {}
      var url = API_BASE_FCM + '/api/orders/' + encodeURIComponent(orderNumber) + '/fcm-token';
      fcmLog('POSTing token', { url: url, order_number: orderNumber });
      return fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_number: orderNumber, fcm_token: token })
      }).then(function(resp){
        fcmLog('POST /api/orders/:orderNumber/fcm-token status', resp && resp.status);
        if (!resp || !resp.ok) {
          return (resp && resp.text ? resp.text() : Promise.resolve('')).then(function(t){ fcmWarn('POST token failed', resp && resp.status, t); return resp; }).catch(function(){ fcmWarn('POST token failed', resp && resp.status); return resp; });
        }
        return resp;
      }).catch(function(e){ fcmWarn('POST token error', e); return null; });
    }).catch(function(e){ fcmWarn('getToken/register error', e); return null; });
  } catch (e) { fcmWarn('registerFcmTokenForOrder exception', e); return Promise.resolve(null); }
}
document.addEventListener('visibilitychange', function(){
  try{ updateEnableNotificationsButton(); }catch(e){}
  try{ if (!document.hidden && localStorage.getItem('faridkebab_last_order') && typeof showMyOrder === 'function') showMyOrder(false); }catch(e){}
});
window.addEventListener('pageshow', function(){
  try{ if (localStorage.getItem('faridkebab_last_order') && typeof showMyOrder === 'function') showMyOrder(false); }catch(e){}
});


// Active category tracking for quick nav
function initQuickNavActive() {
    if (!('IntersectionObserver' in window)) return;
    const sections = document.querySelectorAll('section[id]');
    const btns = document.querySelectorAll('.quick-nav-btn');
    if (!sections.length || !btns.length) return;
    const obs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.id;
                btns.forEach(b => b.classList.toggle('active', b.dataset.target === id));
            }
        });
    }, { rootMargin: '-140px 0px -60% 0px', threshold: 0 });
    sections.forEach(s => obs.observe(s));
}

// Cart Functions
function getCartCount() { return cart.reduce((s, i) => s + i.qty, 0); }
function getCartTotal() { return cart.reduce((s, i) => s + i.price * i.qty, 0); }

function addToCart(name, price, qty, requests) {
    const existing = cart.find(i => i.name === name && (i.requests || '') === (requests || ''));
    if (existing) { existing.qty += qty; } else { cart.push({ name, price, qty, requests: requests || '' }); }
    saveCart();
    updateCartUI();
}

function updateCartUI() {
    const count = getCartCount();
    const total = getCartTotal();
    if (floatingCartCount) floatingCartCount.textContent = count;
    if (floatingCartTotal) floatingCartTotal.textContent = '€' + total.toFixed(2);
    if (floatingCartBtn) floatingCartBtn.classList.toggle('visible', count > 0);
    if (cartModalSubtotal) cartModalSubtotal.textContent = '€' + total.toFixed(2);
    if (cartModalCheckout) cartModalCheckout.disabled = cart.length === 0;

    if (cartModalList) {
        if (cart.length === 0) {
            cartModalList.innerHTML = '<p class="cart-empty-note">Il carrello è vuoto</p>';
        } else {
            let html = '';
            cart.forEach(item => {
                html += '<div class="cart-modal-line">' +
                    '<div class="cart-modal-line-info">' +
                    '<span class="cart-modal-line-name">' + item.name + '</span>' +
                    '<span class="cart-modal-line-price">€' + (item.price * item.qty).toFixed(2) + '</span>' +
                    '</div>' +
                    '<div class="cart-modal-line-qty">' +
                    '<button class="qty-minus-small" data-name="' + item.name + '">-</button>' +
                    '<span>' + item.qty + '</span>' +
                    '<button class="qty-plus-small" data-name="' + item.name + '">+</button>' +
                    '</div>' +
                    '<button class="cart-modal-line-remove" data-name="' + item.name + '">Rimuovi</button>' +
                    '</div>';
            });
            cartModalList.innerHTML = html;

            cartModalList.querySelectorAll('.qty-minus-small').forEach(btn => {
                btn.onclick = function() {
                    const item = cart.find(i => i.name === this.dataset.name);
                    if (item) { item.qty--; if (item.qty <= 0) cart = cart.filter(i => i.name !== this.dataset.name); saveCart(); updateCartUI(); }
                };
            });
            cartModalList.querySelectorAll('.qty-plus-small').forEach(btn => {
                btn.onclick = function() {
                    const item = cart.find(i => i.name === this.dataset.name);
                    if (item) { item.qty++; saveCart(); updateCartUI(); }
                };
            });
            cartModalList.querySelectorAll('.cart-modal-line-remove').forEach(btn => {
                btn.onclick = function() {
                    cart = cart.filter(i => i.name !== this.dataset.name);
                    saveCart();
                    updateCartUI();
                };
            });
        }
    }
}

// Modal Functions
function openDishModal(name, price) {
    currentDish = { name, price };
    if (modalDishName) modalDishName.textContent = name;
    if (modalUnitPrice) modalUnitPrice.textContent = 'Prezzo unitario: €' + price.toFixed(2);
    if (qtyInput) qtyInput.value = 1;
    if (specialRequests) specialRequests.value = '';
    if (orderModal) orderModal.classList.add('show');
}

function closeDishModal() {
    if (orderModal) orderModal.classList.remove('show');
    currentDish = null;
}

function openCartModal() {
    updateCartUI();
    if (cartModal) cartModal.classList.add('show');
}

function closeCartModal() {
    if (cartModal) cartModal.classList.remove('show');
}

function openCheckoutModal() {
    closeCartModal();
    const total = getCartTotal();
    if (checkoutGrandTotal) checkoutGrandTotal.textContent = '€' + total.toFixed(2);

    let html = '';
    cart.forEach(item => {
        html += '<p>' + item.name + ' (x' + item.qty + ') - €' + (Number(item.price || 0) * Number(item.qty || 0)).toFixed(2) + (item.requests ? '<br><small>Note: ' + item.requests + '</small>' : '') + '</p>';
    });
    if (checkoutSummary) checkoutSummary.innerHTML = html || '<p>Nessun articolo nel carrello</p>';

    const pickupGroup = document.getElementById('pickup-time-group');
    if (pickupGroup) pickupGroup.style.display = 'block';
    if (checkoutSubmit) checkoutSubmit.disabled = cart.length === 0;
    if (checkoutModal) checkoutModal.classList.add('show');
}

function closeCheckoutModal() {
    if (checkoutModal) checkoutModal.classList.remove('show');
    if (checkoutStatus) checkoutStatus.textContent = '';
}

function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el) {
        const nav = document.querySelector('.navbar');
        const qnav = document.querySelector('.quick-nav');
        const navH = nav ? nav.offsetHeight : 72;
        const qH = qnav ? qnav.offsetHeight : 50;
        const offset = navH + qH + 12;
        const top = el.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
    document.querySelectorAll('.quick-nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.target === id);
    });
}

function closeConfirmModal() {
    if (confirmModal) confirmModal.classList.remove('show');
    // window.location.reload();
}

function isWednesday() {
    const now = new Date();
    const berlin = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
    return berlin.getDay() === 3;
}

function showPromoPopup() {
    const popup = document.getElementById('promo-popup');
    const closeBtn = document.getElementById('promo-close');
    const btn = document.getElementById('promo-btn');
    if (!popup) return;
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' });
    if (localStorage.getItem('promo_shown_date') === today) return;
    popup.classList.add('show');
    localStorage.setItem('promo_shown_date', today);
    if (closeBtn) closeBtn.onclick = function() { popup.classList.remove('show'); };
    if (btn) btn.onclick = function() {
        popup.classList.remove('show');
        scrollToSection('sandwiches-wraps');
        const card = document.querySelector('.dish-card[data-name="Panino Kebab"]');
        if (card) {
            card.classList.add('promo-highlight');
            setTimeout(() => card.classList.remove('promo-highlight'), 3000);
        }
    };
    popup.onclick = function(e) { if (e.target === popup) popup.classList.remove('show'); };
}


function requestOrderNotificationPermission(){
    try{ if('Notification' in window && Notification.permission==='default'){ Notification.requestPermission().catch(function(){}); } }catch(e){}
}
function showOrderToast(message){
    try{
        if(!message) return;
        var t=document.getElementById('order-toast');
        if(!t){
            t=document.createElement('div');
            t.id='order-toast';
            t.style.cssText='position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:10000;max-width:calc(100% - 24px);background:#222;color:#fff;padding:10px 14px;border-radius:10px;box-shadow:0 6px 18px rgba(0,0,0,.25);font-size:14px;line-height:1.3;text-align:center;display:none;';
            document.body.appendChild(t);
        }
        t.textContent=message;
        t.style.display='block';
        clearTimeout(window._orderToastTimer);
        window._orderToastTimer=setTimeout(function(){ try{ t.style.display='none'; }catch(e){} }, 4000);
    }catch(e){}
}
function showOrderNotification(title, body, tag){
    try{ showOrderToast(body || title || 'Aggiornamento ordine'); }catch(e){}
    try{
        if(!('Notification' in window)) return;
        if(Notification.permission!=='granted') return;
        var opts={ body: body, icon: './icon-192.png', badge: './icon-192.png', tag: tag||'farid-order', renotify: true, data:{ url:'./index.html' } };
        if(navigator.serviceWorker && navigator.serviceWorker.ready){
            navigator.serviceWorker.ready.then(function(reg){ reg.showNotification(title, opts); }).catch(function(){ try{ new Notification(title, opts); }catch(e){} });
        } else { try{ new Notification(title, opts); }catch(e){} }
    }catch(e){}
}

async function submitOrder() {
    // Request notification permission on user gesture before any async checkout fetch (Safari/mobile)
    try { requestNotificationPermissionOnGesture(); } catch(e) { fcmWarn('permission gesture call error', e); }

    const name = document.getElementById('customer-name')?.value.trim() || '';
    const phone = document.getElementById('customer-phone')?.value.trim() || '';
    const orderType = 'pickup';
    const itemNotes = cart.map(i => i.requests ? (i.name + ': ' + i.requests) : '').filter(Boolean).join('; ');
    const orderNotes = document.getElementById('order-notes')?.value.trim() || '';
    const notes = [itemNotes, orderNotes].filter(Boolean).join('; ');
    const pickupTime = document.getElementById('pickup-time')?.value || 'ASAP';

    try { const r=await fetch('https://backend-1-osni.onrender.com/api/settings'); const d=await r.json(); if(d.accepting_orders==='false'){ if(checkoutStatus){checkoutStatus.textContent='Ristorante chiuso. Ordini non accettati.';checkoutStatus.className='checkout-status error';} return; } } catch(e){}
    if (!name || !phone) { if (checkoutStatus) { checkoutStatus.textContent = 'Compila nome e telefono.'; checkoutStatus.className = 'checkout-status error'; } return; }
    if (!cart.length) { if (checkoutStatus) { checkoutStatus.textContent = 'Il carrello è vuoto.'; checkoutStatus.className = 'checkout-status error'; } return; }

    const summary = cart.map(i => i.name + ' (x' + i.qty + ') - €' + (Number(i.price || 0) * Number(i.qty || 0)).toFixed(2)).join('\n');
    const total = getCartTotal();
    const order = {
        order_number: 'ORD-' + Date.now().toString().slice(-6),
        order_type: orderType,
        customer_name: name,
        customer_phone: phone,
        delivery_address: null,
        notes: notes,
        delivery_timing: null,
        delivery_time: null,
        pickup_time: pickupTime || 'ASAP',
        subtotal: getCartTotal(),
        delivery_fee: 0,
        total: total,
        items: cart.map(i => ({ name: i.name, qty: Number(i.qty || 0), price: Number(i.price || 0) }))
    };

    try {
        const API_URL = 'https://backend-1-osni.onrender.com';
        const resp = await fetch(API_URL + '/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(order)
        });
        if (!resp.ok) throw new Error('fail');
    } catch(e) {
        if (checkoutStatus) { checkoutStatus.textContent = 'Ordine non inviato. Il server è attivo?'; checkoutStatus.className = 'checkout-status error'; }
        return;
    }

    if (confirmTitle) confirmTitle.textContent = 'Ordine Confermato!';
    const leaveMsg = 'Puoi uscire: riceverai notifiche sullo stato del tuo ordine.';
    if (confirmMessage) confirmMessage.textContent = 'Grazie, ' + name + '!\n\n' + summary + '\n\nTotale: €' + total.toFixed(2) + '\nRitiro: ' + (pickupTime || 'ASAP') + (notes ? '\nNote: ' + notes : '') + '\n\n' + leaveMsg;
    if (confirmModal) confirmModal.classList.add('show');
    try { showNotificationPopup(true); } catch(e){}

    localStorage.setItem("faridkebab_last_order", order.order_number);
    try{ localStorage.removeItem('faridkebab_last_notified_status'); }catch(e){}
    try{ localStorage.setItem('faridkebab_last_order_data', JSON.stringify(Object.assign({ status: 'new', created_at: new Date().toISOString() }, order))); }catch(e){}
    try { updateEnableNotificationsButton(); } catch(e){}
    requestOrderNotificationPermission();
    try { if (typeof showMyOrder === 'function') showMyOrder(true); } catch(e){}
    showOrderNotification('Ordine inviato', leaveMsg, 'order-' + order.order_number);
    cart = [];
    saveCart();
    updateCartUI();
    closeCheckoutModal();
    try {
        if (__fcmPermissionPromise && typeof __fcmPermissionPromise.then === 'function') {
            __fcmPermissionPromise.then(function(){ registerFcmTokenForOrder(order.order_number); }).catch(function(){ registerFcmTokenForOrder(order.order_number); });
        } else {
            registerFcmTokenForOrder(order.order_number);
        }
    } catch(e) { try{ registerFcmTokenForOrder(order.order_number); }catch(_e){} }
}

function getSavedAddresses() {
    try { return JSON.parse(localStorage.getItem('faridkebab_addresses') || '[]'); }
    catch { return []; }
}
function saveSavedAddresses(addrs) {
    try { localStorage.setItem('faridkebab_addresses', JSON.stringify(addrs)); } catch(e) {}
}
function openSavedAddressesModal() {
    renderSavedAddressesList();
    const m = document.getElementById('saved-addresses-modal');
    if (m) m.classList.add('show');
}
function closeSavedAddressesModal() {
    const m = document.getElementById('saved-addresses-modal');
    if (m) m.classList.remove('show');
}
function renderSavedAddressesList() {
    const list = document.getElementById('saved-addresses-list');
    if (!list) return;
    const addrs = getSavedAddresses();
    if (addrs.length === 0) { list.innerHTML = '<p class="cart-empty-note">Nessun indirizzo salvato</p>'; return; }
    let html = '';
    addrs.forEach((a, i) => {
        html += '<div class="cart-modal-line saved-addr-line" data-idx="' + i + '" style="cursor:pointer;">' +
            '<span class="cart-modal-line-name">' + (a.label || '') + ' - ' + (a.address || '') + '</span>' +
            '<button class="cart-modal-line-remove" data-idx="' + i + '">Rimuovi</button>' +
            '</div>';
    });
    list.innerHTML = html;
    list.querySelectorAll('.saved-addr-line').forEach(line => {
        line.addEventListener('click', function(e) {
            if (e.target.classList.contains('cart-modal-line-remove')) return;
            const idx = parseInt(this.dataset.idx);
            const addrs = getSavedAddresses();
            if (addrs[idx]) {
                const a = addrs[idx];
                if (document.getElementById('customer-name')) document.getElementById('customer-name').value = a.name || '';
                if (document.getElementById('customer-phone')) document.getElementById('customer-phone').value = a.phone || '';
                if (document.getElementById('addr-street')) document.getElementById('addr-street').value = a.street || (a.address.split(', ')[0] || '');
                if (document.getElementById('addr-city')) document.getElementById('addr-city').value = a.city || (a.address.split(', ')[1] || '');
                if (document.getElementById('addr-postcode')) document.getElementById('addr-postcode').value = a.postcode || (a.address.split(', ')[2] || '');
                closeSavedAddressesModal();
            }
        });
    });
    list.querySelectorAll('.cart-modal-line-remove').forEach(btn => {
        btn.onclick = function() {
            const idx = parseInt(this.dataset.idx);
            if (!confirm('Rimuovere questo indirizzo salvato?')) return;
            let addrs = getSavedAddresses();
            addrs = addrs.filter((_, i) => i !== idx);
            saveSavedAddresses(addrs);
            renderSavedAddressesList();
        };
    });
}

document.addEventListener('DOMContentLoaded', function() {
    try {
        const savedCart = localStorage.getItem('faridkebab_cart');
        if (savedCart) cart = JSON.parse(savedCart);
    } catch(e) { cart = []; }

    initQuickNavActive();
    const mobBtn=document.getElementById("my-order-btn"); if(mobBtn){ mobBtn.style.display="flex"; mobBtn.addEventListener("click", function(){ showMyOrder(true); }); }

function showMyOrder(openModal){
    const key="faridkebab_last_order"; const dataKey="faridkebab_last_order_data";
    const num=localStorage.getItem(key); const mob=document.getElementById("my-order-btn"); const modal=document.getElementById("my-order-modal"); const el=document.getElementById("my-order-status");
    if(num){ try{ registerFcmTokenForOrder(num); }catch(e){} }
    if(!num){
        window._orderStatusLocked = false;
        if(openModal){ alert("Per favore, ordina qualcosa prima."); }
        if(mob)mob.style.display="none"; if(modal)modal.classList.remove("show"); if(window._myOrderTimer){clearInterval(window._myOrderTimer);window._myOrderTimer=null;} return;
    }
    if(mob)mob.style.display="flex";
    if(openModal && modal) modal.classList.add("show");
    try{
        var closeBtn = document.getElementById('my-order-close');
        if (closeBtn && !closeBtn._bound) {
            closeBtn._bound = true;
            closeBtn.addEventListener('click', function(){
                if (window._orderStatusLocked) return;
                try{ localStorage.removeItem(key); localStorage.removeItem(dataKey); localStorage.removeItem('faridkebab_last_notified_status'); }catch(e){}
                if(window._myOrderTimer){clearInterval(window._myOrderTimer);window._myOrderTimer=null;}
                window._lastRenderedOrderStatus=null; window._orderCompletedNotified=false; window._orderStatusLocked=false;
                if(modal) modal.classList.remove('show');
                if(mob) mob.style.display='none';
            });
        }
        if (modal && !modal._bound) {
            modal._bound = true;
            modal.addEventListener('click', function(e){ if(e.target===modal){ if (window._orderStatusLocked) return; if(closeBtn) closeBtn.click(); } });
        }
        updateEnableNotificationsButton();
    }catch(e){ fcmWarn('enable notifications button setup error', e); }
    function playOrderCompleteSound(){
        try{
            const C=window.AudioContext||window.webkitAudioContext; if(!C) return;
            if(!window._orderAudioCtx) window._orderAudioCtx=new C();
            const ctx=window._orderAudioCtx; if(ctx.state==="suspended") ctx.resume();
            const beep=(t,f)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type="sine";o.frequency.value=f;o.connect(g);g.connect(ctx.destination);g.gain.setValueAtTime(0.001,t);g.gain.exponentialRampToValueAtTime(0.2,t+0.02);g.gain.exponentialRampToValueAtTime(0.001,t+0.18);o.start(t);o.stop(t+0.2);};
            beep(ctx.currentTime,880); beep(ctx.currentTime+0.22,1174);
        }catch(e){}
    }
    function render(d){
        if(!d) return;
        const statuses=["new","accepted","preparing","ready","completed"]; const rejected=d.status==="rejected"; const idx=rejected?-1:statuses.indexOf(d.status);
        const labels={new:"Nuovo",accepted:"Accettato",preparing:"In preparazione",ready:"Pronto per il ritiro",completed:"Completato",rejected:"Rifiutato"};
        const notifyMsgs={new:"Ordine ricevuto",accepted:"Ordine accettato",preparing:"Ordine in preparazione",ready:"Ordine pronto per il ritiro",completed:"Ordine completato!",rejected:"Ordine rifiutato"};
        const prevStatus=(window._lastRenderedOrderStatus||"");
        const notifiedKey='faridkebab_last_notified_status';
        const lastNotified=localStorage.getItem(notifiedKey)||'';
        if(d.status && d.status!==lastNotified){
            try{ localStorage.setItem(notifiedKey, d.status); }catch(e){}
            const msg=notifyMsgs[d.status]||labels[d.status]||d.status;
            showOrderNotification('Stato ordine ' + (d.order_number||num||''), msg, 'order-' + (d.order_number||num||'status'));
        }
        if(d.status==="completed" && prevStatus!=="completed" && !window._orderCompletedNotified){
            window._orderCompletedNotified=true;
            showOrderToast("Ordine completato!");
            playOrderCompleteSound();
        }
        window._lastRenderedOrderStatus=d.status;
        const idxR=rejected?-1:statuses.indexOf(d.status);
        let html="<div class='order-timeline'>";statuses.forEach((s,i)=>{const done=!rejected&&i<=idxR;const cur=!rejected&&i===idxR;html+="<div class='tl-step"+(done?" done":"")+(cur?" current":"")+"'><span class='tl-dot'></span><span class='tl-label'>"+labels[s]+"</span></div>";});if(rejected)html+="<div class='tl-step rejected current'><span class='tl-dot'></span><span class='tl-label'>"+labels.rejected+"</span></div>";html+="</div>";
        html+="<div class='order-current'>"+(labels[d.status]||d.status)+"</div>";
        const eta = d.pickup_time || "ASAP";
        html+="<div class='order-eta'>Ritiro: "+eta+"</div>";
        if(d.items&&d.items.length){html+="<ul class='order-items'>"+d.items.map(i=>"<li>"+Number(i.qty||0)+"x "+(i.name||'')+" <span>\u20ac"+(Number(i.qty||0)*Number(i.price||0)).toFixed(2)+"</span></li>").join("")+"</ul>";}
        const itemsTotal = (d.items||[]).reduce((s,i)=>s + (Number(i.qty||0)*Number(i.price||0)), 0);
        const shownTotal = (d.total!=null && !isNaN(Number(d.total)) && Number(d.total)>0) ? Number(d.total) : itemsTotal;
        html+="<div class='order-total'>Totale: \u20ac"+shownTotal.toFixed(2)+"</div>";
        if(el)el.innerHTML=html;
        const isDone = (d.status === 'completed' || d.status === 'rejected');
        window._orderStatusLocked = !isDone;
        try{
            var _closeBtn = document.getElementById('my-order-close');
            var _modal = document.getElementById('my-order-modal');
            if (_closeBtn) _closeBtn.style.display = isDone ? '' : 'none';
            if (_modal && !isDone) _modal.classList.add('show');
        }catch(e){}
        try{ localStorage.setItem(key, String(d.order_number||num||'')); localStorage.setItem(dataKey,JSON.stringify(d)); }catch(e){}
        if(d.status==="completed" || d.status==="rejected"){
            if(window._myOrderTimer){clearInterval(window._myOrderTimer);window._myOrderTimer=null;}
            // unlock/allow close when done; kept stored until user closes or new order replaces it
        }
    }
    let cached=null; try{cached=JSON.parse(localStorage.getItem(dataKey)||"null");}catch(e){}
    if(cached && String(cached.order_number||"")===String(num)) render(cached);
    if(window._myOrderTimer){clearInterval(window._myOrderTimer);window._myOrderTimer=null;}
    function tick(){
        const n=localStorage.getItem(key); if(!n){ if(window._myOrderTimer){clearInterval(window._myOrderTimer);window._myOrderTimer=null;} return; }
        fetch("https://backend-1-osni.onrender.com/api/orders/lookup/"+encodeURIComponent(n)).then(r=>{if(!r.ok)throw new Error("not found");return r.json();}).then(d=>render(d)).catch(()=>{});
    }
    tick();
    if(localStorage.getItem(key)) window._myOrderTimer=setInterval(tick,5000);
}
try{ updateEnableNotificationsButton(); }catch(e){}
try{ scheduleNotificationPopup(2000); }catch(e){}
if(localStorage.getItem("faridkebab_last_order")) { try{ registerFcmTokenForOrder(localStorage.getItem("faridkebab_last_order")); }catch(e){} showMyOrder(false); }


    document.querySelectorAll('.quick-nav-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            scrollToSection(this.dataset.target);
        });
    });

    document.querySelectorAll('.dish-card').forEach(card => {
        card.addEventListener('click', function(e) {
            if (e.target.closest('.add-to-cart-btn')) return;
            if (e.target.closest('.size-selector')) return;
            openDishModal(this.dataset.name, parseFloat(this.dataset.price));
        });
    });
    document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const card = this.closest('.dish-card');
            if (!card) return;
            openDishModal(card.dataset.name, parseFloat(card.dataset.price));
        });
    });

    document.querySelectorAll('.size-selector').forEach(sel => {
        sel.addEventListener('change', function() {
            const card = this.closest('.dish-card');
            const option = this.options[this.selectedIndex];
            const price = parseFloat(option.dataset.price);
            card.dataset.price = price.toFixed(2);
            const priceEl = card.querySelector('.dish-card-price');
            if (priceEl) priceEl.textContent = '€' + price.toFixed(2);
            const btn = card.querySelector('.add-to-cart-btn');
            if (btn) { btn.dataset.price = price.toFixed(2); btn.dataset.name = card.dataset.name + ' (' + this.value + ')'; }
        });
    });
    document.querySelectorAll('.size-selector').forEach(sel => {
        sel.dispatchEvent(new Event('change'));
    });

    if (modalAdd) modalAdd.addEventListener('click', function() {
        if (!currentDish) return;
        const qty = Math.max(1, Math.min(99, parseInt(qtyInput?.value, 10) || 1));
        const req = specialRequests?.value.trim() || '';
        addToCart(currentDish.name, currentDish.price, qty, req);
        closeDishModal();
    });
    if (modalCancel) modalCancel.addEventListener('click', closeDishModal);
    if (modalClose) modalClose.addEventListener('click', closeDishModal);
    if (orderModal) orderModal.addEventListener('click', function(e) { if (e.target === orderModal) closeDishModal(); });
    if (qtyMinus) qtyMinus.addEventListener('click', function() { if (qtyInput) qtyInput.value = Math.max(1, (parseInt(qtyInput.value) || 1) - 1); });
    if (qtyPlus) qtyPlus.addEventListener('click', function() { if (qtyInput) qtyInput.value = Math.min(99, (parseInt(qtyInput.value) || 1) + 1); });

    if (floatingCartBtn) floatingCartBtn.addEventListener('click', openCartModal);
    if (cartModalClose) cartModalClose.addEventListener('click', closeCartModal);
    if (cartModalCheckout) cartModalCheckout.addEventListener('click', openCheckoutModal);
    if (cartModal) cartModal.addEventListener('click', function(e) { if (e.target === cartModal) closeCartModal(); });

    if (checkoutClose) checkoutClose.addEventListener('click', closeCheckoutModal);
    if (checkoutBack) checkoutBack.addEventListener('click', closeCheckoutModal);
    if (checkoutSubmit) checkoutSubmit.addEventListener('click', submitOrder);
    if (checkoutModal) checkoutModal.addEventListener('click', function(e) { if (e.target === checkoutModal) closeCheckoutModal(); });

    if (confirmOk) confirmOk.addEventListener('click', closeConfirmModal);
    if (confirmModal) confirmModal.addEventListener('click', function(e) { if (e.target === confirmModal) closeConfirmModal(); });

    if (isWednesday()) {
        document.querySelectorAll('.dish-card').forEach(card => {
            if (card.dataset.name === 'Panino Kebab') {
                card.dataset.price = '4.50';
                const priceEl = card.querySelector('.dish-card-price');
                if (priceEl) priceEl.textContent = '€4.50';
                const btn = card.querySelector('.add-to-cart-btn');
                if (btn) btn.dataset.price = '4.50';
                const offer = card.querySelector('.wed-offer');
                if (offer) offer.style.display = 'block';
            }
        });
    }

    updateCartUI();
    if (isWednesday()) setTimeout(showPromoPopup, 400);

    // Scroll reveal
    if ('IntersectionObserver' in window) {
        const obs = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    obs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.08, rootMargin: '0px 0px -20px 0px' });
        document.querySelectorAll('.dish-card, section[id]').forEach((el, i) => {
            el.classList.add('reveal');
            el.style.transitionDelay = (i * 0.04) + 's';
            obs.observe(el);
        });
    } else {
        document.querySelectorAll('.dish-card, section[id]').forEach(el => {
            el.classList.add('reveal', 'visible');
        });
    }
});


function initFixedFallback() {
    var nav=document.querySelector('.quick-nav');
    var navbar=document.querySelector('.navbar');
    if(!nav||!navbar) return;
    var threshold=nav.getBoundingClientRect().top + window.scrollY - navbar.offsetHeight;
    function onScroll(){
        if(window.scrollY >= threshold){
            nav.classList.add('is-fixed');
        } else {
            nav.classList.remove('is-fixed');
        }
    }
    window.addEventListener('scroll', onScroll, {passive:true});
    window.addEventListener('resize', function(){ threshold=nav.getBoundingClientRect().top+window.scrollY-navbar.offsetHeight; onScroll(); }, {passive:true});
    onScroll();
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', initFixedFallback);
else initFixedFallback();




window.showMyOrder=showMyOrder;

async function applyAccepting(){
  try{const r=await fetch('https://backend-1-osni.onrender.com/api/settings');const d=await r.json();
  const closed=String(d.accepting_orders)==='false';
  let b=document.getElementById('closed-banner');
  if(closed){
    if(!b){b=document.createElement('div');b.id='closed-banner';b.style.cssText='position:fixed;bottom:0;left:0;right:0;background:#000;color:#fff;padding:10px;text-align:center;z-index:9999;';b.textContent='Ordini chiusi';document.body.appendChild(b);}
    const s=document.getElementById('checkout-submit'); if(s) s.disabled=true;
  } else {
    if(b) b.remove();
    const s=document.getElementById('checkout-submit'); if(s) s.disabled=false;
  }
  }catch(e){}
}
setInterval(applyAccepting,5000); applyAccepting();
