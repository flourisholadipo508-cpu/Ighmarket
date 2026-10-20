// Did this visit come from a password reset email? (check before Supabase clears the link)
const cameFromRecovery = location.hash.includes('type=recovery');

// ---------- Supabase setup (fill these in later) ----------
const supabaseUrl = 'https://rkdasiyctqzdcdmsnnui.supabase.co';
const supabaseKey = 'sb_publishable_zReOxI6DnAGU07iIjA_M-w_vO31z8Es';


// If the keys are still placeholders, the site runs in demo mode
// (sample items) so you can keep working on the design.
let db = null;
try {
    if (!supabaseUrl.startsWith('YOUR_') && !supabaseKey.startsWith('YOUR_')) {
        db = window.supabase.createClient(supabaseUrl, supabaseKey);
    }
} catch (err) {
    console.error('Supabase setup failed:', err);
}


// ---------- Elements ----------
const navHome = document.getElementById('nav-home');
const navCategory = document.getElementById('nav-category');
const navWishlist = document.getElementById('nav-wishlist');
const navProfile = document.getElementById('nav-profile');
const navSellHeader = document.getElementById('nav-sell-header');

const browseSection = document.getElementById('browse-section');
const categorySection = document.getElementById('category-section');
const wishlistSection = document.getElementById('wishlist-section');
const profileSection = document.getElementById('profile-section');

const listingsGrid = document.getElementById('listings-grid');
const categoryGrid = document.getElementById('category-grid');
const uploadForm = document.getElementById('upload-form');
const formError = document.getElementById('form-error');
const submitBtn = document.getElementById('submit-btn');

const detailSection = document.getElementById('detail-section');
const detailContent = document.getElementById('detail-content');
const detailBack = document.getElementById('detail-back');
const sellerSection = document.getElementById('seller-section');
const sellerContent = document.getElementById('seller-content');

const allNavItems = [navHome, navCategory, navWishlist, navProfile];
const adminSection = document.getElementById('admin-section');
const allSections = [browseSection, categorySection, wishlistSection, profileSection, detailSection, sellerSection, adminSection];

// ---------- Helpers ----------
const FEED_SPINNER = '<div class="feed-loading"><span class="spinner spinner-dark"></span></div>';

function setButtonLoading(btn, isLoading, text) {
    if (isLoading) {
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner"></span>${text}`;
    } else {
        btn.disabled = false;
        btn.textContent = text;
    }
}
function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const itemsById = {};

function cardMetaHTML(item) {
    const tags = [];
    if (item.condition) tags.push(item.condition === 'new' ? 'New' : 'Used');
    if (item.negotiable) tags.push('Negotiable');
    const loc = item.location ? `<span class="card-loc">📍 ${escapeHtml(item.location)}</span>` : '';
    return `<div class="card-meta">${tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>${loc}`;
}

function cardHTML(item) {
    const key = String(item.id ?? item.title);
    itemsById[key] = item;
    const hasImage = item.image_urls && item.image_urls[0];
    const img = hasImage
                ? `<img loading="lazy" src="${escapeHtml(item.image_urls[0])}" alt="${escapeHtml(item.title)}">`
        : `<div class="card-img-placeholder">No photo</div>`;
    const phone = encodeURIComponent((item.sellers && item.sellers.whatsapp_number) || '');
    return `
                        <div class="card" data-id="${escapeHtml(key)}">
            <div class="card-media">${img}${heartButtonHTML(key)}</div>
            <h3>${escapeHtml(item.title)}</h3>
                        <p>₦${Number(item.price).toLocaleString()}</p>
            ${cardMetaHTML(item)}
            <a href="https://wa.me/${phone}" target="_blank" rel="noopener" class="whatsapp-btn">
                Chat on WhatsApp
            </a>
        </div>`;
}

async function fetchItems(category = 'all') {
    if (!db) {
        return {
            items: demoItems.filter(i => category === 'all' || i.category === category),
            error: null
        };
    }
    let query = db.from('listings').select('*, sellers(store_name, whatsapp_number)');
    if (category !== 'all') query = query.eq('category', category);
    const { data, error } = await query.order('created_at', { ascending: false });
    return { items: data || [], error };
}



async function loadListings(grid, category = 'all') {
        grid.innerHTML = FEED_SPINNER;
    const { items, error } = await fetchItems(category);
    if (error) {
        console.error(error);
        grid.innerHTML = '<p class="status-msg">Error loading items.</p>';
        return;
    }
        gridItems[grid.id] = items;
    gridHints[grid.id] = '';
    renderGrid(grid);
}

// ---------- Home feed: Explore / For You / Following ----------
let currentHomeTab = 'explore';

function getCategoryTaps() {
    try { return JSON.parse(localStorage.getItem('ighCategoryTaps')) || {}; }
    catch (err) { return {}; }
}

function recordCategoryTap(category) {
    if (!category || category === 'all') return;
    try {
        const taps = getCategoryTaps();
        taps[category] = (taps[category] || 0) + 1;
        localStorage.setItem('ighCategoryTaps', JSON.stringify(taps));
    } catch (err) {}
}

async function loadHomeTab(tab) {
    currentHomeTab = tab;
    document.querySelectorAll('.feed-option').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === tab);
    });

    if (tab === 'explore') {
        await loadListings(listingsGrid);
        return;
    }

    if (tab === 'foryou') {
        listingsGrid.innerHTML = '<p class="status-msg">Loading items...</p>';
        const { items, error } = await fetchItems('all');
        if (currentHomeTab !== tab) return;
        if (error) {
            console.error(error);
            listingsGrid.innerHTML = '<p class="status-msg">Error loading items.</p>';
            return;
        }
        const taps = getCategoryTaps();
        const hint = Object.keys(taps).length
            ? ''
            : '<p class="status-msg">Browse a few categories and this feed will start matching your taste.</p>';
        const sorted = items
            .map((item, index) => ({ item, index }))
            .sort((a, b) =>
                ((taps[b.item.category] || 0) - (taps[a.item.category] || 0)) || (a.index - b.index))
            .map(x => x.item);
                gridItems['listings-grid'] = sorted;
        gridHints['listings-grid'] = hint;
        renderGrid(listingsGrid);
        return;
    }

           await loadFollowingFeed();
}

// Three-dots menu
const feedMenuBtn = document.getElementById('feed-menu-btn');
const feedMenu = document.getElementById('feed-menu');

function closeFeedMenu() {
    feedMenu.style.display = 'none';
    feedMenuBtn.setAttribute('aria-expanded', 'false');
}

feedMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (feedMenu.style.display === 'block') {
        closeFeedMenu();
    } else {
        feedMenu.style.display = 'block';
        feedMenuBtn.setAttribute('aria-expanded', 'true');
    }
});

document.addEventListener('click', closeFeedMenu);

document.querySelectorAll('.feed-option').forEach(btn => {
    btn.addEventListener('click', () => {
        closeFeedMenu();
        loadHomeTab(btn.dataset.tab);
    });
});


// ---------- Item details page ----------
const categoryLabels = {
    appliances: 'Appliances',
    furniture: 'Furniture',
    clothing: 'Clothing',
    accessories: 'Accessories',
    decoration: 'Decoration'
};

let detailBackIndex = 0;
let detailBackScroll = 0;

let detailItem = null;

function openDetail(item) {
    detailItem = item;
    const activeIndex = allNavItems.findIndex(n => n.classList.contains('active'));
    detailBackIndex = activeIndex >= 0 ? activeIndex : 0;
    detailBackScroll = window.scrollY;

    const images = item.image_urls || [];
    const seller = item.sellers || {};
    const storeName = seller.store_name || 'Seller';
    const initials = storeName.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const phone = encodeURIComponent(seller.whatsapp_number || '');
    const message = encodeURIComponent(`Hi, I'm interested in "${item.title}" on IGH Market.`);
    const posted = item.created_at
        ? new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : '';

    let gallery = '<div class="detail-no-photo">No photo</div>';
    if (images.length) {
        gallery = `<img id="detail-main-img" class="detail-main-img" src="${escapeHtml(images[0])}" alt="${escapeHtml(item.title)}">`;
        if (images.length > 1) {
            gallery += '<div class="detail-thumbs">' + images.map((url, i) =>
                `<img class="detail-thumb${i === 0 ? ' active' : ''}" src="${escapeHtml(url)}" data-src="${escapeHtml(url)}" alt="">`
            ).join('') + '</div>';
        }
    }

    detailContent.innerHTML = `
        <div class="detail-card">
                        <div class="detail-gallery">${gallery}${heartButtonHTML(String(item.id ?? item.title))}</div>
            <div class="detail-info">
                <span class="detail-category">${escapeHtml(categoryLabels[item.category] || item.category || '')}</span>
                <h2>${escapeHtml(item.title)}</h2>
                                <p class="detail-price">₦${Number(item.price).toLocaleString()}${item.negotiable ? '<small class="neg"> · Negotiable</small>' : ''}</p>
                <div class="detail-facts">
                    ${item.condition ? `<span class="tag">${item.condition === 'new' ? 'New' : 'Used'}</span>` : ''}
                    ${item.location ? `<span class="detail-loc">📍 ${escapeHtml(item.location)}</span>` : ''}
                </div>
                <h3>Description</h3>
                <p class="detail-desc">${escapeHtml(item.description || 'No description provided.')}</p>
                                <div class="detail-seller" data-seller-id="${escapeHtml(item.seller_id || '')}">
                    <div class="avatar detail-avatar">${escapeHtml(initials)}</div>
                    <div>
                        <strong>${escapeHtml(storeName)}</strong>
                        ${posted ? `<span>Posted ${posted}</span>` : ''}
                    </div>
                </div>
                                               <a class="whatsapp-btn detail-wa" href="https://wa.me/${phone}?text=${message}" target="_blank" rel="noopener">Chat on WhatsApp</a>
                <div class="share-row">
                    <button type="button" class="outline-btn share-btn" data-id="${escapeHtml(item.id)}" data-title="${escapeHtml(item.title)}" data-price="${escapeHtml(item.price)}">Share</button>
                    <button type="button" class="outline-btn copy-btn" data-id="${escapeHtml(item.id)}">Copy link</button>
                </div>
                <p class="safety-tip">🛡️ Stay safe: meet in a public place and don't pay before you see the item.</p>
                ${(currentUser && currentUser.id === item.seller_id) ? '' : reportBoxHTML(item.id)}
            </div>
        </div>`;

    allSections.forEach(sec => sec.style.display = 'none');
        detailSection.style.display = 'block';
    trackListing(item, 'view');
    window.scrollTo(0, 0);
}

// Tap a card (but not its WhatsApp link) to open it
document.addEventListener('click', (e) => {
       if (e.target.closest('a, .heart-btn')) return;
    const card = e.target.closest('.card');
    if (!card) return;
    const item = itemsById[card.dataset.id];
    if (item) openDetail(item);
});

// Tap a small photo to show it big
detailContent.addEventListener('click', (e) => {
    const sellerBox = e.target.closest('.detail-seller');
    if (sellerBox && sellerBox.dataset.sellerId) {
        openSeller(sellerBox.dataset.sellerId);
        return;
    }
    const thumb = e.target.closest('.detail-thumb');
    if (!thumb) return;
    document.getElementById('detail-main-img').src = thumb.dataset.src;
    detailContent.querySelectorAll('.detail-thumb').forEach(t => t.classList.toggle('active', t === thumb));
});

detailBack.addEventListener('click', () => {
    switchTab(allNavItems[detailBackIndex], allSections[detailBackIndex]);
    window.scrollTo(0, detailBackScroll);
});

// ---------- Tab switching ----------
function switchTab(activeNav, activeSection) {
    allNavItems.forEach(nav => nav.classList.remove('active'));
    allSections.forEach(sec => sec.style.display = 'none');
    activeNav.classList.add('active');
    activeSection.style.display = 'block';
    window.scrollTo(0, 0);
}

navHome.addEventListener('click', (e) => {
    e.preventDefault();
    switchTab(navHome, browseSection);
    loadHomeTab('explore');
});

navCategory.addEventListener('click', (e) => {
    e.preventDefault();
    switchTab(navCategory, categorySection);
    showCategoryHome();
});
navWishlist.addEventListener('click', (e) => {
    e.preventDefault();
    switchTab(navWishlist, wishlistSection);
    loadWishlist();
});

navProfile.addEventListener('click', (e) => {
    e.preventDefault();
    switchTab(navProfile, profileSection);
});

navSellHeader.addEventListener('click', () => {
    switchTab(navProfile, profileSection);
        if (currentUser && currentUser.is_seller) {
        document.getElementById('post-form-card').scrollIntoView({ behavior: 'smooth' });
    } else if (currentUser) {
        document.getElementById('client-note').scrollIntoView({ behavior: 'smooth' });
    } else {
        setAuthMode('signin');
        authCard.scrollIntoView({ behavior: 'smooth' });
    }
});


document.getElementById('wishlist-browse').addEventListener('click', () => navHome.click());

function showCategoryHome() {
    document.getElementById('category-results').style.display = 'none';
    document.getElementById('category-home').style.display = 'block';
}

function openCategory(cat) {
    document.getElementById('category-home').style.display = 'none';
    document.getElementById('category-results').style.display = 'block';
    document.getElementById('cat-title').textContent =
        cat === 'all' ? 'All Items' : (categoryLabels[cat] || cat);
    const clear = document.querySelector('.filter-wrap[data-scope="category"] .f-clear');
    if (clear) clear.click();
    recordCategoryTap(cat);
    loadListings(categoryGrid, cat);
    window.scrollTo(0, 0);
}

document.getElementById('category-home').addEventListener('click', (e) => {
    const tile = e.target.closest('[data-cat]');
    if (tile) openCategory(tile.dataset.cat);
});

document.getElementById('cat-back').addEventListener('click', () => {
    showCategoryHome();
    window.scrollTo(0, 0);
});
// ---------- Image compressor ----------
async function compressImage(file, maxWidth = 1000, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('Compression failed'));
                        return;
                    }
                    resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
                }, 'image/jpeg', quality);
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}

// ---------- Post a listing ----------
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError.textContent = '';
            setButtonLoading(submitBtn, true, editingId ? 'Saving...' : 'Publishing...');

    try {
               if (!currentUser) throw new Error('Please sign in to post an item.');
        if (!currentUser.is_seller) throw new Error('Only seller accounts can post items.');
        if (!db) {
            throw new Error('Demo mode: add your Supabase details at the top of app.js to publish for real.');
        }

        const title = document.getElementById('title').value;
        const category = document.getElementById('category').value;
                const price = parseFloat(document.getElementById('price').value);
        const condition = document.getElementById('condition').value;
        const negotiable = document.getElementById('negotiable').checked;
        const itemLocation = document.getElementById('location').value.trim();
        const description = document.getElementById('description').value;
        const imageFiles = document.getElementById('images').files;

        if (imageFiles.length > 4) {
            throw new Error('You can only select a maximum of 4 pictures.');
        }

        const imageUrls = [];
        for (const file of imageFiles) {
            const compressed = await compressImage(file);
            const randomString = Math.random().toString(36).substring(2, 7);
            const fileName = `${currentUser.id}-${Date.now()}-${randomString}.jpg`

            const { error: uploadErr } = await db.storage
                .from('listing-images')
                .upload(fileName, compressed);
            if (uploadErr) throw uploadErr;

            const { data: urlData } = db.storage
                .from('listing-images')
                .getPublicUrl(fileName);
            imageUrls.push(urlData.publicUrl);
        }

                if (editingId) {
            const old = myListings[editingId];
                        const updates = { title, description, price, category, condition, negotiable, location: itemLocation };
            if (imageUrls.length) updates.image_urls = imageUrls;

            const { data: updated, error: updErr } = await db
                .from('listings')
                .update(updates)
                .eq('id', editingId)
                .select('id');
            if (updErr) throw updErr;
            if (!updated || !updated.length) {
                throw new Error('Could not save: this listing was not found or is not yours.');
            }

            if (imageUrls.length && old) {
                const names = storageNamesFromUrls(old.image_urls);
                if (names.length) await db.storage.from('listing-images').remove(names);
            }

            exitEditMode();
            await loadMyListings();
            document.getElementById('my-listings-card').scrollIntoView({ behavior: 'smooth' });
            alert('Changes saved!');
        } else {
            const { error: dbErr } = await db.from('listings').insert([{
                seller_id: currentUser.id,
                title,
                description,
                price,
                                category,
                condition,
                negotiable,
                location: itemLocation,
                image_urls: imageUrls
            }]);
            if (dbErr) throw dbErr;

            updateListingCount();
            loadMyListings();
            alert('Item posted successfully!');
            uploadForm.reset();
            navHome.click();
        }
    } catch (err) {
        formError.textContent = err.message;
    } finally {
                        setButtonLoading(submitBtn, false, editingId ? 'Save Changes' : 'Publish to IghMarket');
    }
});

// ---------- Toast bubble ----------
let toastTimer;

function showToast(title, text) {
    let el = document.getElementById('toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'toast';
        el.className = 'toast';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        el.innerHTML = '<div class="toast-check">✓</div><div class="toast-text"><strong></strong><span></span></div>';
        el.addEventListener('click', () => el.classList.remove('show'));
        document.body.appendChild(el);
    }
    el.querySelector('strong').textContent = title;
    el.querySelector('span').textContent = text || '';
    void el.offsetWidth; // restart the slide-in
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 7000);
}

// ---------- CAPTCHA (Cloudflare Turnstile) ----------
const TURNSTILE_SITE_KEY = '0x4AAAAAAFbuju2RgfXMXb_k';
let captchaWidgetId = null;
let captchaToken = '';

function ensureCaptcha(tries = 0) {
    if (captchaWidgetId !== null || tries > 40) return;
    if (window.turnstile) {
        captchaWidgetId = turnstile.render('#captcha-box', {
            sitekey: TURNSTILE_SITE_KEY,
            callback: (t) => { captchaToken = t; },
            'expired-callback': () => { captchaToken = ''; },
            'error-callback': () => { captchaToken = ''; }
        });
    } else {
        setTimeout(() => ensureCaptcha(tries + 1), 300);
    }
}

function resetCaptcha() {
    captchaToken = '';
    if (window.turnstile && captchaWidgetId !== null) turnstile.reset(captchaWidgetId);
}

// ---------- Accounts ----------
let currentUser = null; // { id, email, store_name, whatsapp_number }
let authMode = 'signin';

const profileGuest = document.getElementById('profile-guest');
const profileUser = document.getElementById('profile-user');
const authCard = document.getElementById('auth-card');
const authForm = document.getElementById('auth-form');
const authError = document.getElementById('auth-error');
const authSubmit = document.getElementById('auth-submit');

function showAuthMessage(text, ok = false) {
    authError.style.color = ok ? '#2e7d32' : '';
    authError.textContent = text;
}

function applyAccountType() {
    const type = (document.querySelector('input[name="account-type"]:checked') || {}).value || 'client';
    const isSellerType = type === 'seller';
    const showSeller = authMode === 'signup' && isSellerType;
    document.getElementById('auth-name-label').textContent = isSellerType ? 'Store Name' : 'Your Name';
    document.getElementById('auth-whatsapp-group').style.display = showSeller ? 'block' : 'none';
    document.getElementById('auth-whatsapp').required = showSeller;
}

document.querySelectorAll('input[name="account-type"]').forEach(r => {
    r.addEventListener('change', applyAccountType);
});

function setAuthMode(mode) {
    authMode = mode;
    const signup = mode === 'signup';
    authCard.style.display = 'block';
    document.getElementById('auth-title').textContent = signup ? 'Create Account' : 'Sign In';
    authSubmit.textContent = signup ? 'Create Account' : 'Sign In';
    document.getElementById('auth-switch-text').textContent = signup ? 'Already have an account?' : 'New here?';
    document.getElementById('auth-switch-btn').textContent = signup ? 'Sign in' : 'Create an account';
        document.querySelectorAll('.signup-only').forEach(el => el.style.display = signup ? 'block' : 'none');
    document.querySelectorAll('.signin-only').forEach(el => el.style.display = signup ? 'none' : 'block');
    document.getElementById('auth-name').required = signup;
          applyAccountType();
    showAuthMessage('');
    setTimeout(() => { if (authCard.style.display !== 'none') ensureCaptcha(); }, 0);
}

function applyRoleView() {
    if (!currentUser) return;
    document.querySelectorAll('.seller-only').forEach(el => el.style.display = currentUser.is_seller ? '' : 'none');
    document.querySelectorAll('.client-only').forEach(el => el.style.display = currentUser.is_seller ? 'none' : '');
    const tier = currentUser.tier || 'free';
    document.getElementById('profile-badge').textContent =
                currentUser.is_seller ? tier.charAt(0).toUpperCase() + tier.slice(1) + ' Tier' : 'Buyer';
    fillSettings();
}

async function refreshSellerStatus() {
    if (!db || !currentUser) return;
    const userId = currentUser.id;
    const { data, error } = await db
        .from('sellers')
        .select('store_name, whatsapp_number, tier')
        .eq('id', userId)
        .maybeSingle();
    if (error) {
        console.error(error);
        return;
    }
    if (!currentUser || currentUser.id !== userId) return; // logged out meanwhile
    currentUser.is_seller = !!data;
    if (data) {
        currentUser.store_name = data.store_name;
        currentUser.whatsapp_number = data.whatsapp_number;
        currentUser.tier = data.tier;
    }
       applyRoleView();
    if (currentUser.is_seller) loadMyListings();
}

async function updateListingCount() {
    const el = document.getElementById('stat-listings');
    if (!el || !currentUser || !db) return;
    const { count, error } = await db
        .from('listings')
        .select('id', { count: 'exact', head: true })
                .eq('seller_id', currentUser.id)
        .eq('is_sold', false);
    if (error) {
        console.error(error);
        return;
    }
    el.textContent = `${count || 0} / 10`;
}

function renderProfile() {
    const loggedIn = !!currentUser;
    profileGuest.style.display = loggedIn ? 'none' : 'block';
    profileUser.style.display = loggedIn ? 'block' : 'none';
    if (loggedIn) {
                const name = currentUser.display_name || currentUser.store_name || currentUser.email || 'Me';
                       applyRoleView();
                refreshSellerStatus();
                loadWishlistIds();
        loadFollowingIds();
        checkAdmin();
        document.getElementById('profile-name').textContent = name;
               document.getElementById('profile-avatar').textContent =
            name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
        updateListingCount();
    }
}

function userFromSupabase(user) {
    if (!user) return null;
    const meta = user.user_metadata || {};
        return {
        id: user.id,
        email: user.email,
        store_name: meta.store_name || '',
        display_name: meta.display_name || meta.store_name || '',
        whatsapp_number: meta.whatsapp_number || '',
        is_seller: meta.account_type === 'seller' || !!meta.store_name
    };
}

function saveDemoUser(user) {
    try {
        if (user) localStorage.setItem('ighDemoUser', JSON.stringify(user));
        else localStorage.removeItem('ighDemoUser');
    } catch (err) {}
}

async function initAuth() {
    if (db) {
        const { data } = await db.auth.getSession();
        currentUser = userFromSupabase(data.session && data.session.user);
                db.auth.onAuthStateChange((event, session) => {
            currentUser = userFromSupabase(session && session.user);
            renderProfile();
            if (event === 'PASSWORD_RECOVERY') showResetCard();
        });
    } else {
        try { currentUser = JSON.parse(localStorage.getItem('ighDemoUser')); }
        catch (err) { currentUser = null; }
    }
    renderProfile();
}

document.getElementById('show-signin').addEventListener('click', () => setAuthMode('signin'));
document.getElementById('show-signup').addEventListener('click', () => setAuthMode('signup'));
document.getElementById('auth-switch-btn').addEventListener('click', () => {
    setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showAuthMessage('');
        setButtonLoading(authSubmit, true, authMode === 'signup' ? 'Creating account...' : 'Signing in...');

    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
        const store_name = document.getElementById('auth-name').value.trim();
    const accountType = (document.querySelector('input[name="account-type"]:checked') || {}).value || 'client';
    let whatsapp_number = document.getElementById('auth-whatsapp').value.replace(/\D/g, '');
if (whatsapp_number.startsWith('0')) whatsapp_number = '234' + whatsapp_number.slice(1);

    try {
        if (!db) {
            // Demo mode: fake local account so you can design the logged-in screen
            currentUser = {
                id: 'demo-user',
                email,
                store_name: authMode === 'signup' ? store_name : email.split('@')[0],
                whatsapp_number
            };
            saveDemoUser(currentUser);
        } else if (authMode === 'signup') {
                        if (!captchaToken) throw new Error('Please wait for the security check to finish, then try again.');
            const { data, error } = await db.auth.signUp({
                email,
                password,
                                            options: {
                    captchaToken,
                    data: {
                        account_type: accountType,
                        display_name: store_name,
                        store_name: accountType === 'seller' ? store_name : '',
                        whatsapp_number: accountType === 'seller' ? whatsapp_number : ''
                    }
                }
            });
            if (error) throw error;
            if (!data.session) {
                                showAuthMessage('Account created. Check your email to confirm it, then sign in.', true);
                showToast('Confirmation email sent', `We sent a link to ${email}. Check your inbox (and spam), tap it, then sign in.`);
                return;
            }
            currentUser = userFromSupabase(data.session.user);
        } else {
                        if (!captchaToken) throw new Error('Please wait for the security check to finish, then try again.');
            const { data, error } = await db.auth.signInWithPassword({ email, password, options: { captchaToken } });
            if (error) throw error;
            currentUser = userFromSupabase(data.user);
        }
        authForm.reset();
        authCard.style.display = 'none';
        renderProfile();
    } catch (err) {
        showAuthMessage(err.message);
    } finally {
                        setButtonLoading(authSubmit, false, authMode === 'signup' ? 'Create Account' : 'Sign In');
        resetCaptcha();
    }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
    if (db) await db.auth.signOut();
        else saveDemoUser(null);
        currentUser = null;
    wishlistIds.clear();
    followingIds.clear();
    refreshHearts();
    renderProfile();
});
// ---------- Search, filters and sorting ----------
const FILTER_BAR_HTML = `
    <div class="filter-bar">
        <input type="search" class="f-search" placeholder="Search items...">
        <button type="button" class="f-toggle">Filters</button>
    </div>
    <div class="filter-panel" style="display: none;">
        <div class="filter-row">
                        <label>Location
                <select class="f-location"><option value="">All locations</option></select>
            </label>
            <label>Sort by
                <select class="f-sort">
                    <option value="newest">Default</option>
                    <option value="low">Price: low to high</option>
                    <option value="high">Price: high to low</option>
                </select>
            </label>
        </div>
        <div class="filter-row">
            <label>Min price (₦)<input type="number" class="f-min" min="0" placeholder="0"></label>
            <label>Max price (₦)<input type="number" class="f-max" min="0" placeholder="Any"></label>
        </div>
        <button type="button" class="link-btn f-clear">Clear filters</button>
    </div>`;

const gridItems = {};
const gridHints = {};
const gridScopes = { 'listings-grid': 'home', 'category-grid': 'category' };

function getFilters(scope) {
    const wrap = document.querySelector(`.filter-wrap[data-scope="${scope}"]`);
    if (!wrap) return null;
    return {
        text: wrap.querySelector('.f-search').value.trim().toLowerCase(),
        sort: wrap.querySelector('.f-sort').value,
        min: parseFloat(wrap.querySelector('.f-min').value),
                max: parseFloat(wrap.querySelector('.f-max').value),
        location: wrap.querySelector('.f-location').value
    };
    };

function applyFilters(items, f) {
    if (!f) return items;
    let out = items.filter(item => {
        const price = Number(item.price);
        if (!isNaN(f.min) && price < f.min) return false;
                if (!isNaN(f.max) && price > f.max) return false;
        if (f.location && (item.location || '').trim().toLowerCase() !== f.location) return false;
        if (!f.text) return true;
        const hay = [
            item.title,
            item.description,
            categoryLabels[item.category] || item.category,
                        item.location,
            item.condition,
            item.sellers && item.sellers.store_name
        ].join(' ').toLowerCase();
        return f.text.split(/\s+/).every(word => hay.includes(word));
    });
    if (f.sort === 'low') out = [...out].sort((a, b) => a.price - b.price);
    if (f.sort === 'high') out = [...out].sort((a, b) => b.price - a.price);
    return out;
}

function updateLocationOptions(scope, items) {
    const wrap = document.querySelector(`.filter-wrap[data-scope="${scope}"]`);
    if (!wrap) return;
    const select = wrap.querySelector('.f-location');
    const current = select.value;
    const seen = new Map();
    items.forEach(i => {
        const loc = (i.location || '').trim();
        if (loc && !seen.has(loc.toLowerCase())) seen.set(loc.toLowerCase(), loc);
    });
    if (current && !seen.has(current)) seen.set(current, current);
    const locs = [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    select.innerHTML = '<option value="">All locations</option>' +
        locs.map(([key, label]) => `<option value="${escapeHtml(key)}">${escapeHtml(label)}</option>`).join('');
    select.value = current;
}

const PAGE_SIZE = 12;
const gridShown = {};

function moreButtonHTML(remaining) {
    if (remaining <= 0) return '';
    return `<div class="more-wrap"><button type="button" class="more-btn">Show more (${remaining} left)</button></div>`;
}

function showMore(grid) {
    const items = gridItems[grid.id];
    if (!items) return;
    const filtered = applyFilters(items, getFilters(gridScopes[grid.id]));
    const start = gridShown[grid.id] || 0;
    const next = filtered.slice(start, start + PAGE_SIZE);
    gridShown[grid.id] = start + next.length;
    const wrap = grid.querySelector('.more-wrap');
    if (!wrap) return;
    wrap.insertAdjacentHTML('beforebegin', next.map(cardHTML).join(''));
    const left = filtered.length - gridShown[grid.id];
    if (left <= 0) wrap.remove();
    else wrap.querySelector('.more-btn').textContent = `Show more (${left} left)`;
}

document.addEventListener('click', (e) => {
    const btn = e.target.closest('.more-btn');
    if (!btn) return;
    const grid = btn.closest('.grid');
    if (grid && gridItems[grid.id]) showMore(grid);
});

function renderGrid(grid) {
    const items = gridItems[grid.id];
    if (!items) return;
    updateLocationOptions(gridScopes[grid.id], items);
    const filtered = applyFilters(items, getFilters(gridScopes[grid.id]));
    const hint = gridHints[grid.id] || '';
    if (!filtered.length) {
        const msg = items.length ? 'No items match your search.' : 'No items found.';
        grid.innerHTML = hint + `<p class="status-msg">${msg}</p>`;
        return;
    }
        const shown = filtered.slice(0, PAGE_SIZE);
    gridShown[grid.id] = shown.length;
    grid.innerHTML = hint + shown.map(cardHTML).join('') + moreButtonHTML(filtered.length - shown.length);
}

document.querySelectorAll('.filter-wrap').forEach(wrap => {
    wrap.innerHTML = FILTER_BAR_HTML;
    const scope = wrap.dataset.scope;
    const grid = document.getElementById(scope === 'home' ? 'listings-grid' : 'category-grid');
    const panel = wrap.querySelector('.filter-panel');
    const toggle = wrap.querySelector('.f-toggle');
    let timer;

    const updateLabel = () => {
        const f = getFilters(scope);
        let n = 0;
        if (f.sort !== 'newest') n++;
        if (!isNaN(f.min)) n++;
                if (!isNaN(f.max)) n++;
        if (f.location) n++;
        toggle.textContent = n ? `Filters (${n})` : 'Filters';
    };
    const rerender = () => {
        updateLabel();
        renderGrid(grid);
    };

    wrap.querySelector('.f-search').addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(rerender, 200);
    });
        wrap.querySelectorAll('.f-sort, .f-min, .f-max, .f-location').forEach(el => el.addEventListener('input', rerender));
    toggle.addEventListener('click', () => {
        panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
    });
    wrap.querySelector('.f-clear').addEventListener('click', () => {
        wrap.querySelector('.f-search').value = '';
        wrap.querySelector('.f-sort').value = 'newest';
        wrap.querySelector('.f-min').value = '';
                wrap.querySelector('.f-max').value = '';
        wrap.querySelector('.f-location').value = '';
        rerender();
    });
});

// ---------- Wishlist ----------
const wishlistIds = new Set();
const HEART_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';

function heartButtonHTML(id) {
    const active = wishlistIds.has(id) ? ' active' : '';
    return `<button type="button" class="heart-btn${active}" data-id="${escapeHtml(id)}" aria-label="Save to wishlist">${HEART_SVG}</button>`;
}

function refreshHearts() {
    document.querySelectorAll('.heart-btn').forEach(b => {
        b.classList.toggle('active', wishlistIds.has(b.dataset.id));
    });
    const stat = document.getElementById('stat-wishlist');
    if (stat) stat.textContent = wishlistIds.size;
}

async function loadWishlistIds() {
    if (!db || !currentUser) {
        wishlistIds.clear();
        refreshHearts();
        return;
    }
    const userId = currentUser.id;
    const { data, error } = await db.from('wishlist').select('listing_id').eq('user_id', userId);
    if (error) {
        console.error(error);
        return;
    }
    if (!currentUser || currentUser.id !== userId) return;
    wishlistIds.clear();
    (data || []).forEach(r => wishlistIds.add(r.listing_id));
    refreshHearts();
}

async function toggleWishlist(listingId) {
    if (!currentUser) {
        switchTab(navProfile, profileSection);
        setAuthMode('signin');
        showAuthMessage('Sign in to save items to your wishlist.', true);
        authCard.scrollIntoView({ behavior: 'smooth' });
        return;
    }
    if (!db) return;

    const wasSaved = wishlistIds.has(listingId);
    if (wasSaved) wishlistIds.delete(listingId);
    else wishlistIds.add(listingId);
    refreshHearts();

    const { error } = wasSaved
        ? await db.from('wishlist').delete().eq('user_id', currentUser.id).eq('listing_id', listingId)
        : await db.from('wishlist').insert([{ user_id: currentUser.id, listing_id: listingId }]);

    if (error) {
        console.error(error);
        if (wasSaved) wishlistIds.add(listingId);
        else wishlistIds.delete(listingId);
        refreshHearts();
        alert('Could not update your wishlist. Please try again.');
        return;
    }

    // Unsaving from the Wishlist page: remove the card right away
    if (wasSaved && wishlistSection.style.display === 'block') {
        document.querySelectorAll('#wishlist-grid .card').forEach(c => {
            if (c.dataset.id === listingId) c.remove();
        });
        if (!document.querySelector('#wishlist-grid .card')) loadWishlist();
    }
}

async function loadWishlist() {
    const grid = document.getElementById('wishlist-grid');
    const emptyHTML = (title, text, label, goto) => `
        <div class="empty-state">
            <img src="heart (1).png" alt="" class="empty-icon">
            <h3>${title}</h3>
            <p>${text}</p>
            <button type="button" class="primary-btn" data-goto="${goto}">${label}</button>
        </div>`;

    if (!currentUser) {
        grid.innerHTML = emptyHTML('Sign in to see your wishlist', 'Save items you like and find them here later.', 'Sign In', 'profile');
        return;
    }
    if (!db) return;

    const userId = currentUser.id;
    grid.innerHTML = FEED_SPINNER;
    const { data, error } = await db
        .from('wishlist')
        .select('listing_id, listings(*, sellers(store_name, whatsapp_number))')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (!currentUser || currentUser.id !== userId) return;
    if (error) {
        console.error(error);
        grid.innerHTML = '<p class="muted">Could not load your wishlist.</p>';
        return;
    }

    const items = (data || []).map(r => r.listings).filter(i => i && !i.is_sold);
    grid.innerHTML = items.length
        ? '<div class="grid">' + items.map(cardHTML).join('') + '</div>'
        : emptyHTML('Nothing saved yet', 'Tap the heart on an item you like and it will be kept here.', 'Browse Items', 'home');
}

// Tap any heart
document.addEventListener('click', (e) => {
    const heart = e.target.closest('.heart-btn');
    if (heart) toggleWishlist(heart.dataset.id);
});

// Buttons inside the wishlist page
document.getElementById('wishlist-grid').addEventListener('click', (e) => {
    const go = e.target.closest('[data-goto]');
    if (!go) return;
    if (go.dataset.goto === 'home') navHome.click();
    else navProfile.click();
});

// ---------- Seller page and Follow ----------
const followingIds = new Set();
let sellerFollowers = 0;

function emptyStateHTML(title, text, label, goto) {
    return `
        <div class="empty-state">
            <img src="user.png" alt="" class="empty-icon">
            <h3>${title}</h3>
            <p>${text}</p>
            <button type="button" class="primary-btn" data-goto="${goto}">${label}</button>
        </div>`;
}

function refreshFollowButtons() {
    document.querySelectorAll('.follow-btn').forEach(b => {
        const on = followingIds.has(b.dataset.seller);
        b.classList.toggle('active', on);
        b.textContent = on ? 'Following' : 'Follow';
    });
}

function showFollowerCount() {
    const el = document.getElementById('seller-followers');
    if (el) el.textContent = `${sellerFollowers} follower${sellerFollowers === 1 ? '' : 's'}`;
}

async function loadFollowingIds() {
    if (!db || !currentUser) {
        followingIds.clear();
        return;
    }
    const userId = currentUser.id;
    const { data, error } = await db.from('follows').select('seller_id').eq('follower_id', userId);
    if (error) {
        console.error(error);
        return;
    }
    if (!currentUser || currentUser.id !== userId) return;
    followingIds.clear();
    (data || []).forEach(r => followingIds.add(r.seller_id));
    refreshFollowButtons();
}

async function toggleFollow(sellerId) {
    if (!currentUser) {
        switchTab(navProfile, profileSection);
        setAuthMode('signin');
        showAuthMessage('Sign in to follow sellers.', true);
        authCard.scrollIntoView({ behavior: 'smooth' });
        return;
    }
    if (!db || currentUser.id === sellerId) return;

    const wasFollowing = followingIds.has(sellerId);
    if (wasFollowing) {
        followingIds.delete(sellerId);
        sellerFollowers = Math.max(0, sellerFollowers - 1);
    } else {
        followingIds.add(sellerId);
        sellerFollowers += 1;
    }
    refreshFollowButtons();
    showFollowerCount();

    const { error } = wasFollowing
        ? await db.from('follows').delete().eq('follower_id', currentUser.id).eq('seller_id', sellerId)
        : await db.from('follows').insert([{ follower_id: currentUser.id, seller_id: sellerId }]);

    if (error) {
        console.error(error);
        if (wasFollowing) {
            followingIds.add(sellerId);
            sellerFollowers += 1;
        } else {
            followingIds.delete(sellerId);
            sellerFollowers = Math.max(0, sellerFollowers - 1);
        }
        refreshFollowButtons();
        showFollowerCount();
        alert('Could not update. Please try again.');
    }
}

async function openSeller(sellerId) {
    if (!db) return;
    allSections.forEach(sec => sec.style.display = 'none');
    sellerSection.style.display = 'block';
    sellerContent.innerHTML = FEED_SPINNER;
    window.scrollTo(0, 0);

    const [sellerRes, itemsRes, countRes] = await Promise.all([
        db.from('sellers').select('id, store_name, whatsapp_number, created_at').eq('id', sellerId).maybeSingle(),
        db.from('listings').select('*, sellers(store_name, whatsapp_number)')
            .eq('seller_id', sellerId).eq('is_sold', false).order('created_at', { ascending: false }),
        db.rpc('follower_count', { p_seller: sellerId })
    ]);

    if (sellerSection.style.display !== 'block') return; // user already left
    if (sellerRes.error || !sellerRes.data) {
        console.error(sellerRes.error);
        sellerContent.innerHTML = '<p class="muted">Could not load this seller.</p>';
        return;
    }

    const seller = sellerRes.data;
    const items = itemsRes.data || [];
    sellerFollowers = Number(countRes.data) || 0;
    const initials = (seller.store_name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const joined = seller.created_at
        ? new Date(seller.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
        : '';
    const isMe = currentUser && currentUser.id === seller.id;
    const phone = encodeURIComponent(seller.whatsapp_number || '');

    sellerContent.innerHTML = `
        <div class="seller-card">
            <div class="avatar seller-avatar">${escapeHtml(initials)}</div>
            <div class="seller-meta">
                <h2>${escapeHtml(seller.store_name)}</h2>
                <p>${joined ? 'Joined ' + joined + ' · ' : ''}${items.length} item${items.length === 1 ? '' : 's'} · <span id="seller-followers"></span></p>
            </div>
        </div>
        <div class="seller-actions">
            ${isMe
                ? '<span class="muted">This is your store.</span>'
                : `<button type="button" class="primary-btn follow-btn" data-seller="${escapeHtml(seller.id)}">Follow</button>`}
            <a class="outline-btn" href="https://wa.me/${phone}" target="_blank" rel="noopener">Chat on WhatsApp</a>
        </div>
        <h3 class="seller-sub">Items for sale</h3>
        <div class="grid">
            ${items.length ? items.map(cardHTML).join('') : '<p class="status-msg">No items for sale right now.</p>'}
        </div>`;

    showFollowerCount();
    refreshFollowButtons();
}

sellerContent.addEventListener('click', (e) => {
    const btn = e.target.closest('.follow-btn');
    if (btn) toggleFollow(btn.dataset.seller);
});

document.getElementById('seller-back').addEventListener('click', () => {
    switchTab(allNavItems[detailBackIndex], allSections[detailBackIndex]);
    window.scrollTo(0, detailBackScroll);
});

async function loadFollowingFeed() {
    gridItems['listings-grid'] = null;

    if (!currentUser) {
        listingsGrid.innerHTML = emptyStateHTML(
            'Sign in to follow sellers',
            'Follow sellers and their new items will show up here.',
            'Sign In', 'profile');
        return;
    }
    if (!db) return;

    listingsGrid.innerHTML = FEED_SPINNER;
    await loadFollowingIds();
    if (currentHomeTab !== 'following') return;

    if (!followingIds.size) {
        listingsGrid.innerHTML = emptyStateHTML(
            "You're not following anyone yet",
            "Open an item, tap the seller's name, then tap Follow.",
            'Browse Items', 'explore');
        return;
    }

    const { data, error } = await db
        .from('listings')
        .select('*, sellers(store_name, whatsapp_number)')
        .eq('is_sold', false)
        .in('seller_id', [...followingIds])
        .order('created_at', { ascending: false });

    if (currentHomeTab !== 'following') return;
    if (error) {
        console.error(error);
        listingsGrid.innerHTML = '<p class="status-msg">Error loading items.</p>';
        return;
    }
    if (!data || !data.length) {
        listingsGrid.innerHTML = emptyStateHTML(
            'Nothing new yet',
            'The sellers you follow have nothing for sale right now.',
            'Browse Items', 'explore');
        return;
    }

    gridItems['listings-grid'] = data;
    gridHints['listings-grid'] = '';
    renderGrid(listingsGrid);
}

// Buttons inside empty messages on Home
listingsGrid.addEventListener('click', (e) => {
    const go = e.target.closest('[data-goto]');
    if (!go) return;
    if (go.dataset.goto === 'explore') loadHomeTab('explore');
    else navProfile.click();
});

// ---------- Report a listing ----------
const REPORT_REASONS = [
    'Scam or fraud',
    'Prohibited item',
    'Wrong category',
    'Duplicate listing',
    'Offensive or inappropriate',
    'Other'
];

function reportBoxHTML(listingId) {
    return `
        <div class="report-box">
            <button type="button" class="link-btn report-toggle">⚑ Report this listing</button>
            <form class="report-form" style="display: none;" data-listing="${escapeHtml(listingId)}">
                <p class="report-msg"></p>
                <label>Reason
                    <select class="report-reason">${REPORT_REASONS.map(r => `<option>${r}</option>`).join('')}</select>
                </label>
                <label>Details (optional)
                    <textarea class="report-details" maxlength="500"></textarea>
                </label>
                <button type="submit" class="primary-btn full">Send report</button>
            </form>
        </div>`;
}

detailContent.addEventListener('click', (e) => {
    const toggle = e.target.closest('.report-toggle');
    if (!toggle) return;
    if (!currentUser) {
        switchTab(navProfile, profileSection);
        setAuthMode('signin');
        showAuthMessage('Sign in to report a listing.', true);
        authCard.scrollIntoView({ behavior: 'smooth' });
        return;
    }
    const form = toggle.parentElement.querySelector('.report-form');
    form.style.display = form.style.display === 'block' ? 'none' : 'block';
});

detailContent.addEventListener('submit', async (e) => {
    const form = e.target.closest('.report-form');
    if (!form) return;
    e.preventDefault();
    const msg = form.querySelector('.report-msg');
    const btn = form.querySelector('button[type="submit"]');
    msg.textContent = '';
    setButtonLoading(btn, true, 'Sending...');
    try {
        if (!currentUser || !db) throw new Error('Please sign in first.');
        const { error } = await db.from('reports').insert([{
            listing_id: form.dataset.listing,
            reporter_id: currentUser.id,
            reason: form.querySelector('.report-reason').value,
            details: form.querySelector('.report-details').value.trim() || null
        }]);
        if (error) {
            if (error.code === '23505') throw new Error("You've already reported this listing.");
            throw error;
        }
        form.closest('.report-box').innerHTML = '<p class="muted">Thanks, we\'ll review this listing.</p>';
    } catch (err) {
        msg.style.color = '#c62828';
        msg.textContent = err.message;
        setButtonLoading(btn, false, 'Send report');
    }
});

// ---------- View and WhatsApp counts ----------
function trackListing(item, kind) {
    if (!db || !item || !item.id) return;
    if (currentUser && currentUser.id === item.seller_id) return; // don't count the owner
    if (kind === 'view') {
        try {
            const key = 'ighViewed-' + item.id;
            if (sessionStorage.getItem(key)) return;
            sessionStorage.setItem(key, '1');
        } catch (err) {}
    }
    db.rpc('track_listing', { p_listing: item.id, p_kind: kind }).then(({ error }) => {
        if (error) console.error(error);
    });
}

detailContent.addEventListener('click', (e) => {
    if (!e.target.closest('.detail-wa')) return;
    const item = detailItem;
    if (item) trackListing(item, 'whatsapp');
});

// ---------- Share an item ----------
function itemLink(id) {
    return location.href.split('#')[0] + '#item=' + id;
}

async function copyText(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (err) {}
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (err) {}
    ta.remove();
    return ok;
}

detailContent.addEventListener('click', async (e) => {
    const shareBtn = e.target.closest('.share-btn');
    const copyBtn = e.target.closest('.copy-btn');
    if (!shareBtn && !copyBtn) return;

    if (copyBtn) {
        const ok = await copyText(itemLink(copyBtn.dataset.id));
        copyBtn.textContent = ok ? 'Copied!' : 'Copy failed';
        setTimeout(() => { copyBtn.textContent = 'Copy link'; }, 1500);
        return;
    }

    const url = itemLink(shareBtn.dataset.id);
    const text = `${shareBtn.dataset.title} - ₦${Number(shareBtn.dataset.price).toLocaleString()} on IGH Market`;
    if (navigator.share) {
        try { await navigator.share({ title: shareBtn.dataset.title, text, url }); } catch (err) {}
        return;
    }
    window.open('https://wa.me/?text=' + encodeURIComponent(text + '\n' + url), '_blank', 'noopener');
});

// Open an item straight from a shared link
async function openItemFromHash() {
    const match = location.hash.match(/^#item=([0-9a-f-]{36})$/i);
    if (!match || !db) return;
    const { data, error } = await db
        .from('listings')
        .select('*, sellers(store_name, whatsapp_number)')
        .eq('id', match[1])
        .eq('is_sold', false)
        .maybeSingle();
    if (error || !data) return;
    openDetail(data);
}

// ---------- My Listings ----------
let myListings = {};

function myListingRow(item) {
    const thumb = item.image_urls && item.image_urls[0]
                ? `<img loading="lazy" src="${escapeHtml(item.image_urls[0])}" alt="">`
        : '<div class="ml-noimg"></div>';
    return `
        <div class="ml-row" data-id="${escapeHtml(item.id)}">
            ${thumb}
            <div class="ml-info">
                <strong>${escapeHtml(item.title)}</strong>
                <span>₦${Number(item.price).toLocaleString()}</span>
                               <span class="ml-status ${item.is_sold ? 'sold' : 'active'}">${item.is_sold ? 'Sold' : 'Active'}</span>
                <span>👁 ${item.views || 0} views · 💬 ${item.whatsapp_clicks || 0} WhatsApp taps</span>
            </div>
                        <div class="ml-actions">
                <button type="button" class="ml-btn" data-action="edit">Edit</button>
                <button type="button" class="ml-btn" data-action="toggle-sold">${item.is_sold ? 'Mark available' : 'Mark as sold'}</button>
                <button type="button" class="ml-btn danger" data-action="delete">Delete</button>
            </div>
        </div>`;
}

async function loadMyListings() {
    const box = document.getElementById('my-listings');
    if (!box || !currentUser || !db) return;
    const userId = currentUser.id;
    box.innerHTML = FEED_SPINNER;

    const { data, error } = await db
        .from('listings')
        .select('*')
        .eq('seller_id', userId)
        .order('created_at', { ascending: false });

    if (!currentUser || currentUser.id !== userId) return;
    if (error) {
        console.error(error);
        box.innerHTML = '<p class="muted">Could not load your listings.</p>';
        return;
    }
    myListings = {};
    (data || []).forEach(i => { myListings[i.id] = i; });
    box.innerHTML = data && data.length
        ? data.map(myListingRow).join('')
        : '<p class="muted">You haven\'t posted anything yet.</p>';
}

document.getElementById('my-listings').addEventListener('click', async (e) => {
    const btn = e.target.closest('.ml-btn');
    if (!btn || !db) return;
    const row = btn.closest('.ml-row');
    const item = myListings[row.dataset.id];
    if (!item) return;

        if (btn.dataset.action === 'edit') {
        startEdit(item);
        return;
    }

    if (btn.dataset.action === 'delete' && !confirm('Delete this listing? This cannot be undone.')) return;

    btn.disabled = true;
    try {
        if (btn.dataset.action === 'toggle-sold') {
            const { error } = await db.from('listings').update({ is_sold: !item.is_sold }).eq('id', item.id);
            if (error) throw error;
        } else {
            const { error } = await db.from('listings').delete().eq('id', item.id);
            if (error) throw error;
            // also remove the photos from storage (best effort)
            const names = (item.image_urls || [])
                .map(url => decodeURIComponent((url.split('/listing-images/')[1] || '').split('?')[0]))
                .filter(Boolean);
            if (names.length) await db.storage.from('listing-images').remove(names);
        }
        await loadMyListings();
        updateListingCount();
    } catch (err) {
        alert(err.message);
        btn.disabled = false;
    }
});

// ---------- Edit listing and account settings ----------
let editingId = null;

function storageNamesFromUrls(urls) {
    return (urls || [])
        .map(url => decodeURIComponent((url.split('/listing-images/')[1] || '').split('?')[0]))
        .filter(Boolean);
}

function startEdit(item) {
    editingId = item.id;
    document.getElementById('title').value = item.title;
    document.getElementById('category').value = item.category;
    document.getElementById('price').value = item.price;
        document.getElementById('description').value = item.description || '';
    document.getElementById('condition').value = item.condition || 'used';
    document.getElementById('negotiable').checked = !!item.negotiable;
    document.getElementById('location').value = item.location || '';
    document.getElementById('images').value = '';
    document.getElementById('images').required = false;
    document.querySelector('label[for="images"]').textContent =
        'Pictures (optional: choose new ones to replace the current photos)';
    document.getElementById('form-title').textContent = 'Edit Listing';
    submitBtn.textContent = 'Save Changes';
    document.getElementById('cancel-edit').style.display = 'block';
    formError.textContent = '';
    document.getElementById('post-form-card').scrollIntoView({ behavior: 'smooth' });
}

function exitEditMode() {
    editingId = null;
    uploadForm.reset();
    formError.textContent = '';
    document.getElementById('images').required = true;
    document.querySelector('label[for="images"]').textContent = 'Pictures (Max 4)';
    document.getElementById('form-title').textContent = 'Post New Listing';
    submitBtn.textContent = 'Publish to IghMarket';
    document.getElementById('cancel-edit').style.display = 'none';
}

document.getElementById('cancel-edit').addEventListener('click', exitEditMode);

function setMsg(el, text, ok = false) {
    el.style.color = ok ? '#2e7d32' : '#c62828';
    el.textContent = text;
}

function fillSettings() {
    if (!currentUser) return;
    if (document.getElementById('settings-panel').open) return; // don't overwrite while typing
    document.getElementById('set-name').value =
        (currentUser.is_seller ? currentUser.store_name : currentUser.display_name) || '';
    document.getElementById('set-name-label').textContent = currentUser.is_seller ? 'Store Name' : 'Your Name';
    document.getElementById('set-whatsapp').value = currentUser.whatsapp_number || '';
}

document.getElementById('settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('settings-msg');
    const btn = document.getElementById('set-save');
    setMsg(msg, '');
    setButtonLoading(btn, true, 'Saving...');
    try {
        if (!currentUser || !db) throw new Error('Please sign in first.');
        const name = document.getElementById('set-name').value.trim();
        if (!name) throw new Error('Please enter a name.');
        let whatsapp = document.getElementById('set-whatsapp').value.replace(/\D/g, '');
        if (whatsapp.startsWith('0')) whatsapp = '234' + whatsapp.slice(1);

        let meta = { display_name: name };
        if (currentUser.is_seller) {
            if (whatsapp.length < 10) throw new Error('Enter a valid WhatsApp number.');
            const { error } = await db
                .from('sellers')
                .update({ store_name: name, whatsapp_number: whatsapp })
                .eq('id', currentUser.id);
            if (error) throw error;
            meta = { display_name: name, store_name: name, whatsapp_number: whatsapp };
        }

        const { error: metaErr } = await db.auth.updateUser({ data: meta });
        if (metaErr) throw metaErr;

        currentUser = {
            ...currentUser,
            display_name: name,
            ...(currentUser.is_seller ? { store_name: name, whatsapp_number: whatsapp } : {})
        };
        renderProfile();
        setMsg(msg, 'Saved.', true);
    } catch (err) {
        setMsg(msg, err.message);
    } finally {
        setButtonLoading(btn, false, 'Save Changes');
    }
});

document.getElementById('password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('password-msg');
    const btn = document.getElementById('pw-save');
    setMsg(msg, '');
    setButtonLoading(btn, true, 'Updating...');
    try {
        if (!currentUser || !db) throw new Error('Please sign in first.');
        const { error } = await db.auth.updateUser({ password: document.getElementById('set-password').value });
        if (error) throw error;
        document.getElementById('password-form').reset();
        setMsg(msg, 'Password changed.', true);
    } catch (err) {
        setMsg(msg, err.message);
    } finally {
        setButtonLoading(btn, false, 'Change Password');
    }
});

// ---------- Forgot password ----------
document.getElementById('forgot-btn').addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value.trim();
    if (!email) {
        showAuthMessage('Type your email above first, then tap Forgot password.');
        return;
    }
    if (!db) return;
        showAuthMessage('');
    if (!captchaToken) {
        showAuthMessage('Please wait for the security check to finish, then try again.');
        return;
    }
    const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/', captchaToken });
    resetCaptcha();
    if (error) showAuthMessage(error.message);
    else showAuthMessage('If that email has an account, a reset link is on its way. Check your inbox.', true);
});

function showResetCard() {
    switchTab(navProfile, profileSection);
    const card = document.getElementById('reset-card');
    card.style.display = 'block';
    card.scrollIntoView({ behavior: 'smooth' });
}

document.getElementById('reset-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('reset-msg');
    const btn = document.getElementById('reset-save');
    setMsg(msg, '');
    setButtonLoading(btn, true, 'Saving...');
    try {
        if (!db) throw new Error('Not connected.');
        const { error } = await db.auth.updateUser({ password: document.getElementById('reset-password').value });
        if (error) throw error;
        document.getElementById('reset-form').reset();
        document.getElementById('reset-card').style.display = 'none';
        alert('Password updated. You are signed in.');
    } catch (err) {
        setMsg(msg, err.message);
    } finally {
        setButtonLoading(btn, false, 'Save Password');
    }
});

// ---------- Admin dashboard ----------
const adminContent = document.getElementById('admin-content');
const adminImages = {};
let adminTab = 'reports';

async function checkAdmin() {
    const entry = document.getElementById('admin-entry');
    entry.style.display = 'none';
    if (!db || !currentUser) return;
    const userId = currentUser.id;
    const { data, error } = await db.rpc('is_admin');
    if (error || !currentUser || currentUser.id !== userId) return;
    currentUser.is_admin = data === true;
    entry.style.display = currentUser.is_admin ? '' : 'none';
}

function adminDate(d) {
    return d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

function adminThumb(l) {
    return l && l.image_urls && l.image_urls[0]
        ? `<img loading="lazy" src="${escapeHtml(l.image_urls[0])}" alt="">`
        : '<div class="admin-noimg"></div>';
}

const ADMIN_SEARCH = '<input type="search" class="f-search admin-search" placeholder="Search...">';

async function renderAdminReports() {
    const { data, error } = await db
        .from('reports')
        .select('*, listings(id, title, price, image_urls, seller_id, sellers(store_name))')
        .eq('status', 'open')
        .order('created_at', { ascending: false });
    if (adminTab !== 'reports') return;
    if (error) {
        console.error(error);
        adminContent.innerHTML = '<p class="muted">Could not load reports.</p>';
        return;
    }
    if (!data.length) {
        adminContent.innerHTML = '<p class="muted">No open reports.</p>';
        return;
    }
    adminContent.innerHTML = `<p class="admin-count">${data.length} open report${data.length === 1 ? '' : 's'}</p>` +
        data.map(r => {
            const l = r.listings || {};
            adminImages[l.id] = l.image_urls;
            return `
            <div class="admin-row" data-report="${escapeHtml(r.id)}" data-listing="${escapeHtml(l.id || '')}">
                ${adminThumb(l)}
                <div class="admin-info">
                    <strong>${escapeHtml(l.title || 'Listing')}</strong>
                    <span>₦${Number(l.price || 0).toLocaleString()} · ${escapeHtml((l.sellers && l.sellers.store_name) || '')}</span>
                    <span class="admin-reason">${escapeHtml(r.reason)}</span>
                    ${r.details ? `<span>${escapeHtml(r.details)}</span>` : ''}
                    <span>${adminDate(r.created_at)}</span>
                </div>
                <div class="admin-actions">
                    <button type="button" class="ml-btn" data-act="view">View</button>
                    <button type="button" class="ml-btn" data-act="dismiss">Dismiss</button>
                    <button type="button" class="ml-btn danger" data-act="remove">Remove listing</button>
                </div>
            </div>`;
        }).join('');
}

async function renderAdminListings() {
    const { data, error } = await db
        .from('listings')
        .select('id, title, price, image_urls, is_sold, created_at, sellers(store_name)')
        .order('created_at', { ascending: false })
        .limit(100);
    if (adminTab !== 'listings') return;
    if (error) {
        console.error(error);
        adminContent.innerHTML = '<p class="muted">Could not load listings.</p>';
        return;
    }
    adminContent.innerHTML = ADMIN_SEARCH + (data.length ? data.map(l => {
        adminImages[l.id] = l.image_urls;
        return `
        <div class="admin-row" data-listing="${escapeHtml(l.id)}">
            ${adminThumb(l)}
            <div class="admin-info">
                <strong>${escapeHtml(l.title)}</strong>
                <span>₦${Number(l.price).toLocaleString()} · ${escapeHtml((l.sellers && l.sellers.store_name) || '')} · ${l.is_sold ? 'Sold' : 'Active'}</span>
                <span>${adminDate(l.created_at)}</span>
            </div>
            <div class="admin-actions">
                <button type="button" class="ml-btn" data-act="view">View</button>
                <button type="button" class="ml-btn danger" data-act="remove">Remove</button>
            </div>
        </div>`;
    }).join('') : '<p class="muted">No listings yet.</p>');
}

async function renderAdminSellers() {
    const { data, error } = await db
        .from('sellers')
        .select('id, store_name, whatsapp_number, tier, suspended, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
    if (adminTab !== 'sellers') return;
    if (error) {
        console.error(error);
        adminContent.innerHTML = '<p class="muted">Could not load sellers.</p>';
        return;
    }
    adminContent.innerHTML = ADMIN_SEARCH + (data.length ? data.map(s => `
        <div class="admin-row" data-seller="${escapeHtml(s.id)}">
            <div class="admin-info">
                <strong>${escapeHtml(s.store_name)}${s.suspended ? ' <span class="admin-reason">· Suspended</span>' : ''}</strong>
                <span>WhatsApp: ${escapeHtml(s.whatsapp_number)}</span>
                <span>${escapeHtml(s.tier || 'free')} tier · joined ${adminDate(s.created_at)}</span>
            </div>
            <div class="admin-actions">
                <button type="button" class="ml-btn${s.suspended ? '' : ' danger'}" data-act="${s.suspended ? 'unsuspend' : 'suspend'}">${s.suspended ? 'Unsuspend' : 'Suspend'}</button>
            </div>
        </div>`).join('') : '<p class="muted">No sellers yet.</p>');
}

async function loadAdminTab(tab) {
    adminTab = tab;
    document.querySelectorAll('.admin-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    if (!db || !currentUser || !currentUser.is_admin) {
        adminContent.innerHTML = '<p class="muted">Not allowed.</p>';
        return;
    }
    adminContent.innerHTML = FEED_SPINNER;
    if (tab === 'reports') await renderAdminReports();
    else if (tab === 'listings') await renderAdminListings();
    else await renderAdminSellers();
}

document.querySelectorAll('.admin-tab').forEach(b => {
    b.addEventListener('click', () => loadAdminTab(b.dataset.tab));
});

document.getElementById('open-admin').addEventListener('click', () => {
    switchTab(navProfile, adminSection);
    window.scrollTo(0, 0);
    loadAdminTab('reports');
});

document.getElementById('admin-back').addEventListener('click', () => {
    switchTab(navProfile, profileSection);
    window.scrollTo(0, 0);
});

adminContent.addEventListener('input', (e) => {
    if (!e.target.classList.contains('admin-search')) return;
    const q = e.target.value.trim().toLowerCase();
    adminContent.querySelectorAll('.admin-row').forEach(row => {
        row.style.display = !q || row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
});

adminContent.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn || !db || !currentUser || !currentUser.is_admin) return;
    const row = btn.closest('.admin-row');
    const act = btn.dataset.act;

    if (act === 'view') {
        window.open(itemLink(row.dataset.listing), '_blank', 'noopener');
        return;
    }
    if (act === 'remove' && !confirm('Remove this listing for good? Its photos and reports are deleted too.')) return;
    if (act === 'suspend' && !confirm("Suspend this seller? Their items disappear from the site and they can't post until you unsuspend them.")) return;

    btn.disabled = true;
    try {
        if (act === 'dismiss') {
            const { data, error } = await db.from('reports').update({ status: 'dismissed' })
                .eq('id', row.dataset.report).select('id');
            if (error) throw error;
            if (!data || !data.length) throw new Error('Nothing changed. Check that the admin SQL ran.');
        } else if (act === 'remove') {
            const id = row.dataset.listing;
            const { data, error } = await db.from('listings').delete().eq('id', id).select('id');
            if (error) throw error;
            if (!data || !data.length) throw new Error('Nothing was removed. Check that the admin SQL ran.');
            const names = storageNamesFromUrls(adminImages[id]);
            if (names.length) await db.storage.from('listing-images').remove(names);
        } else if (act === 'suspend' || act === 'unsuspend') {
            const { error } = await db.rpc('admin_set_suspended', {
                p_seller: row.dataset.seller,
                p_value: act === 'suspend'
            });
            if (error) throw error;
        }
        await loadAdminTab(adminTab);
    } catch (err) {
        alert(err.message);
        btn.disabled = false;
    }
});

// ---------- Become a seller ----------
const becomeSellerBtn = document.getElementById('become-seller-btn');
const becomeSellerForm = document.getElementById('become-seller-form');
const becomeSellerError = document.getElementById('become-seller-error');
const bsSubmit = document.getElementById('bs-submit');

becomeSellerBtn.addEventListener('click', () => {
    becomeSellerBtn.style.display = 'none';
    becomeSellerForm.style.display = 'block';
    document.getElementById('bs-store').value = (currentUser && currentUser.display_name) || '';
});

becomeSellerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    becomeSellerError.textContent = '';
    setButtonLoading(bsSubmit, true, 'Setting up...');
    try {
        if (!currentUser) throw new Error('Please sign in first.');
        if (!db) throw new Error('Not connected to Supabase.');

        const store_name = document.getElementById('bs-store').value.trim();
        let whatsapp_number = document.getElementById('bs-whatsapp').value.replace(/\D/g, '');
        if (whatsapp_number.startsWith('0')) whatsapp_number = '234' + whatsapp_number.slice(1);
        if (!store_name || whatsapp_number.length < 10) {
            throw new Error('Enter your store name and a valid WhatsApp number.');
        }

        const { error } = await db.from('sellers').insert([
            { id: currentUser.id, store_name, whatsapp_number }
        ]);
        if (error) throw error;

        await db.auth.updateUser({
            data: { account_type: 'seller', store_name, whatsapp_number }
        });

        currentUser = { ...currentUser, store_name, whatsapp_number, is_seller: true };
        becomeSellerForm.reset();
        becomeSellerForm.style.display = 'none';
        becomeSellerBtn.style.display = '';
        renderProfile();
    } catch (err) {
        becomeSellerError.textContent = err.message;
    } finally {
        setButtonLoading(bsSubmit, false, 'Start Selling');
    }
});

// ---------- Startup ----------
loadHomeTab('explore');
setAuthMode('signin');
authCard.style.display = 'none';
initAuth().then(() => {
    openItemFromHash();
    if (cameFromRecovery) showResetCard();
});