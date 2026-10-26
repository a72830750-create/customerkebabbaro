// ===== ALI KEBABBARO - Ordering System =====

let cart = [];
function saveCart() { try { localStorage.setItem('forno99_cart', JSON.stringify(cart)); } catch(e) {} }

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
const checkoutSubtotal = document.getElementById('checkout-subtotal');
const checkoutDelivery = document.getElementById('checkout-delivery');
const checkoutGrandTotal = document.getElementById('checkout-grand-total');
const checkoutStatus = document.getElementById('checkout-status');
const confirmModal = document.getElementById('confirm-modal');
const confirmOk = document.getElementById('confirm-ok');
const confirmTitle = document.getElementById('confirm-title');
const confirmMessage = document.getElementById('confirm-message');
const addressGroup = document.getElementById('address-group');

let currentDish = null;

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
                    '<span class="cart-modal-line-name">' + item.name + '</span>' +
                    '<div class="cart-modal-line-qty">' +
                    '<button class="qty-minus-small" data-name="' + item.name + '">-</button>' +
                    '<span>' + item.qty + '</span>' +
                    '<button class="qty-plus-small" data-name="' + item.name + '">+</button>' +
                    '</div>' +
                    '<span class="cart-modal-line-price">€' + (item.price * item.qty).toFixed(2) + '</span>' +
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
    const deliveryFee = 0.00;
    const grandTotal = total + deliveryFee;
    if (checkoutSubtotal) checkoutSubtotal.textContent = '€' + total.toFixed(2);
    if (checkoutDelivery) checkoutDelivery.textContent = '€' + deliveryFee.toFixed(2);
    if (checkoutGrandTotal) checkoutGrandTotal.textContent = '€' + grandTotal.toFixed(2);

    let html = '';
    cart.forEach(item => {
        html += '<p>' + item.name + ' (x' + item.qty + ') - €' + (item.price * item.qty).toFixed(2) + (item.requests ? '<br><small>Note: ' + item.requests + '</small>' : '') + '</p>';
    });
    if (checkoutSummary) checkoutSummary.innerHTML = html || '<p>Nessun articolo nel carrello</p>';

    const minMsg = document.getElementById('min-order-msg');
    const checkoutSubmitBtn = document.getElementById('checkout-submit');
    if (minMsg) {
        const orderType = document.querySelector('input[name="order_type"]:checked')?.value || 'delivery';
        if (orderType === 'delivery' && total < 15) {
            minMsg.textContent = 'Aggiungi €' + (15 - total).toFixed(2) + ' per la consegna.';
            minMsg.style.display = 'block';
            if (checkoutSubmitBtn) checkoutSubmitBtn.disabled = true;
        } else {
            minMsg.textContent = '';
            minMsg.style.display = 'none';
            if (checkoutSubmitBtn) checkoutSubmitBtn.disabled = false;
        }
    }
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
    window.location.reload();
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

async function submitOrder() {
    const name = document.getElementById('customer-name')?.value.trim() || '';
    const phone = document.getElementById('customer-phone')?.value.trim() || '';
    const street = document.getElementById('addr-street')?.value.trim() || '';
    const city = document.getElementById('addr-city')?.value.trim() || '';
    const postcode = document.getElementById('addr-postcode')?.value.trim() || '';
    const address = [street, city, postcode].filter(Boolean).join(', ');
    const orderType = document.querySelector('input[name="order_type"]:checked')?.value || 'delivery';
    const notes = document.getElementById('order-notes')?.value.trim() || '';

    if (orderType === 'delivery' && getCartTotal() < 15) { if (checkoutStatus) { checkoutStatus.textContent = 'Ordine minimo per consegna: €15.00.'; checkoutStatus.className = 'checkout-status error'; } return; }
    if (!name || !phone) { if (checkoutStatus) { checkoutStatus.textContent = 'Compila nome e telefono.'; checkoutStatus.className = 'checkout-status error'; } return; }
    if (orderType === 'delivery' && !address) { if (checkoutStatus) { checkoutStatus.textContent = 'Inserisci indirizzo di consegna.'; checkoutStatus.className = 'checkout-status error'; } return; }
    if (orderType === 'delivery') {
        if (!address.toLowerCase().includes('poggio a caiano')) {
            if (checkoutStatus) { checkoutStatus.textContent = 'Non consegniamo fuori da Poggio a Caiano.'; checkoutStatus.className = 'checkout-status error'; }
            return;
        }
    }

    const summary = cart.map(i => i.name + ' (x' + i.qty + ') - €' + (i.price * i.qty).toFixed(2)).join('\n');
    const deliveryFee = 0.00;
    const total = getCartTotal() + deliveryFee;
    const order = {
        order_number: 'ORD-' + Date.now().toString().slice(-6),
        order_type: orderType,
        customer_name: name,
        customer_phone: phone,
        delivery_address: orderType === 'delivery' ? address : null,
        notes: notes,
        subtotal: getCartTotal(),
        delivery_fee: deliveryFee,
        total: total,
        items: cart.map(i => ({ name: i.name, qty: i.qty, price: i.price }))
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
    if (confirmMessage) confirmMessage.textContent = 'Grazie, ' + name + '!\n\n' + summary + '\n\nTotal: €' + total.toFixed(2) + '\n' + (orderType === 'delivery' ? 'Consegna a: ' + address : 'Ritiro') + (notes ? '\nNote: ' + notes : '');
    if (confirmModal) confirmModal.classList.add('show');

    cart = [];
    saveCart();
    updateCartUI();
    closeCheckoutModal();
}

function getSavedAddresses() {
    try { return JSON.parse(localStorage.getItem('forno99_addresses') || '[]'); }
    catch { return []; }
}
function saveSavedAddresses(addrs) {
    try { localStorage.setItem('forno99_addresses', JSON.stringify(addrs)); } catch(e) {}
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
            let addrs = getSavedAddresses();
            addrs = addrs.filter((_, i) => i !== idx);
            saveSavedAddresses(addrs);
            renderSavedAddressesList();
        };
    });
}

document.addEventListener('DOMContentLoaded', function() {
    try {
        const savedCart = localStorage.getItem('forno99_cart');
        if (savedCart) cart = JSON.parse(savedCart);
    } catch(e) { cart = []; }

    initQuickNavActive();

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

    document.querySelectorAll('input[name="order_type"]').forEach(radio => {
        radio.addEventListener('change', function() {
            if (addressGroup) addressGroup.style.display = this.value === 'delivery' ? 'block' : 'none';
            const minMsg = document.getElementById('min-order-msg');
            const checkoutSubmitBtn = document.getElementById('checkout-submit');
            const total = getCartTotal();
            if (minMsg) {
                if (this.value === 'delivery' && total < 15) {
                    minMsg.textContent = 'Aggiungi €' + (15 - total).toFixed(2) + ' per la consegna.';
                    minMsg.style.display = 'block';
                    if (checkoutSubmitBtn) checkoutSubmitBtn.disabled = true;
                } else {
                    minMsg.textContent = '';
                    minMsg.style.display = 'none';
                    if (checkoutSubmitBtn) checkoutSubmitBtn.disabled = false;
                }
            }
        });
    });

    const saveCheck = document.getElementById('save-address-check');
    if (saveCheck) {
        saveCheck.addEventListener('change', function() {
            const group = document.getElementById('save-address-label-group');
            if (group) group.style.display = this.checked ? 'block' : 'none';
        });
    }

    const openSavedBtn = document.getElementById('open-saved-addresses-btn');
    if (openSavedBtn) openSavedBtn.addEventListener('click', openSavedAddressesModal);
    const savedClose = document.getElementById('saved-addresses-close');
    if (savedClose) savedClose.addEventListener('click', closeSavedAddressesModal);
    const savedCancel = document.getElementById('saved-addresses-cancel');
    if (savedCancel) savedCancel.addEventListener('click', closeSavedAddressesModal);
    const savedModal = document.getElementById('saved-addresses-modal');
    if (savedModal) savedModal.addEventListener('click', function(e) { if (e.target === savedModal) closeSavedAddressesModal(); });

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
