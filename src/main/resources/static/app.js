/* ==========================================================================
   AETHER SPA APPLICATION CONTROLLER
   ========================================================================== */

// BASE URL for API calls
const API_BASE = '/api';

// Global Application State
const state = {
    token: localStorage.getItem('jwt'),
    userId: localStorage.getItem('userId'),
    username: localStorage.getItem('username'),
    email: localStorage.getItem('email'),
    role: localStorage.getItem('role'),
    
    // Feed parameters
    currentPage: 0,
    pageSize: 6,
    searchKeyword: '',
    selectedCategory: '',
    selectedTag: '',
    
    // Active reader / writer blog
    activeBlogId: null
};

// ================= DOM ELEMENT REFERENCES =================
const navGuest = document.getElementById('nav-guest');
const navUser = document.getElementById('nav-user');
const navUsername = document.getElementById('nav-username');
const navUsernameText = document.getElementById('nav-username');

// View Sections
const views = {
    feed: document.getElementById('view-feed'),
    article: document.getElementById('view-article'),
    writer: document.getElementById('view-writer'),
    profile: document.getElementById('view-profile')
};

// Toast
const toastNotify = document.getElementById('toast-notify');
const toastMessage = document.getElementById('toast-message');

// Modals
const modalBackdrop = document.getElementById('modal-backdrop');
const modalLogin = document.getElementById('modal-login');
const modalRegister = document.getElementById('modal-register');

// Form errors
const loginError = document.getElementById('login-error');
const registerError = document.getElementById('register-error');

// ================= INITIALIZATION & ROUTING =================
document.addEventListener('DOMContentLoaded', () => {
    setupAuthNavbar();
    setupEventListeners();
    loadFeed();
});

// View switching engine
function showView(viewName) {
    Object.keys(views).forEach(key => {
        if (key === viewName) {
            views[key].classList.add('active');
        } else {
            views[key].classList.remove('active');
        }
    });
    // Scroll to top upon page change
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Setup authorization states in navbar
function setupAuthNavbar() {
    if (state.token) {
        navGuest.style.display = 'none';
        navUser.style.display = 'flex';
        navUsername.innerHTML = `<i class="fa-solid fa-circle-user"></i> ${state.username}`;
        
        // Show comment submission form
        document.getElementById('comment-form-authenticated').style.display = 'flex';
        document.getElementById('comment-form-guest').style.display = 'none';
        
        // Set avatar initials for comment form
        const commentAvatar = document.getElementById('comment-user-avatar');
        if (commentAvatar) {
            commentAvatar.textContent = state.username.substring(0, 2).toUpperCase();
        }
    } else {
        navGuest.style.display = 'flex';
        navUser.style.display = 'none';
        
        // Show comment signup prompt
        document.getElementById('comment-form-authenticated').style.display = 'none';
        document.getElementById('comment-form-guest').style.display = 'block';
    }
}

// Fetch API Wrapper
async function apiCall(endpoint, method = 'GET', body = null) {
    const headers = {
        'Content-Type': 'application/json'
    };
    
    if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
    }
    
    const config = {
        method,
        headers
    };
    
    if (body) {
        config.body = JSON.stringify(body);
    }
    
    try {
        const response = await fetch(API_BASE + endpoint, config);
        
        // Handle no content deletions
        if (response.status === 204 || response.status === 200 && method === 'DELETE') {
            return { success: true };
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            // Check unauthorized
            if (response.status === 401 || response.status === 403) {
                if (state.token) {
                    showToast('Session expired. Please log in again.', 'error');
                    logout();
                }
            }
            throw data;
        }
        
        return data;
    } catch (error) {
        console.error(`API Call failed to: ${endpoint}`, error);
        throw error;
    }
}

// Toast Alert Messages
function showToast(message, type = 'success') {
    toastMessage.textContent = message;
    toastNotify.className = `toast-notification active ${type}`;
    
    setTimeout(() => {
        toastNotify.classList.remove('active');
    }, 3500);
}

// ================= USER AUTH ACTIONS =================
async function handleLogin(e) {
    e.preventDefault();
    loginError.style.display = 'none';
    
    const usernameInput = document.getElementById('login-username').value;
    const passwordInput = document.getElementById('login-password').value;
    
    try {
        const response = await apiCall('/auth/login', 'POST', {
            username: usernameInput,
            password: passwordInput
        });
        
        // Save to LocalStorage
        localStorage.setItem('jwt', response.token);
        localStorage.setItem('userId', response.id);
        localStorage.setItem('username', response.username);
        localStorage.setItem('email', response.email);
        localStorage.setItem('role', response.role);
        
        // Set application states
        state.token = response.token;
        state.userId = response.id;
        state.username = response.username;
        state.email = response.email;
        state.role = response.role;
        
        showToast(`Welcome back, ${response.username}!`, 'success');
        setupAuthNavbar();
        hideModals();
        
        // Refresh views
        loadFeed();
        
        // Clear login fields
        document.getElementById('login-form').reset();
    } catch (err) {
        loginError.style.display = 'block';
        loginError.textContent = err.message || 'Login failed. Please check credentials.';
    }
}

async function handleRegister(e) {
    e.preventDefault();
    registerError.style.display = 'none';
    
    const usernameInput = document.getElementById('reg-username').value;
    const emailInput = document.getElementById('reg-email').value;
    const passwordInput = document.getElementById('reg-password').value;
    
    try {
        await apiCall('/auth/register', 'POST', {
            username: usernameInput,
            email: emailInput,
            password: passwordInput
        });
        
        showToast('Registration successful! Please login.', 'success');
        hideModals();
        showModal(modalLogin);
        
        // Clear fields
        document.getElementById('register-form').reset();
    } catch (err) {
        registerError.style.display = 'block';
        
        // Format validation messages
        if (typeof err === 'object' && !err.message) {
            const errorKeys = Object.keys(err);
            registerError.textContent = `${errorKeys[0]}: ${err[errorKeys[0]]}`;
        } else {
            registerError.textContent = err.message || 'Registration failed. Try again.';
        }
    }
}

function logout() {
    localStorage.clear();
    state.token = null;
    state.userId = null;
    state.username = null;
    state.email = null;
    state.role = null;
    
    showToast('Signed out successfully.', 'success');
    setupAuthNavbar();
    showView('feed');
    loadFeed();
}

// ================= BLOG PUBLICATION FEED =================
async function loadFeed() {
    const grid = document.getElementById('blogs-grid-container');
    grid.innerHTML = `
        <div class="loading-state">
            <i class="fa-solid fa-spinner fa-spin loading-spinner"></i>
            <p>Fetching beautiful stories...</p>
        </div>`;
        
    try {
        // Construct query parameter string
        let queryParams = `?page=${state.currentPage}&size=${state.pageSize}`;
        if (state.searchKeyword) queryParams += `&keyword=${encodeURIComponent(state.searchKeyword)}`;
        if (state.selectedCategory) queryParams += `&category=${encodeURIComponent(state.selectedCategory)}`;
        if (state.selectedTag) queryParams += `&tag=${encodeURIComponent(state.selectedTag)}`;
        
        const data = await apiCall(`/blogs${queryParams}`);
        renderBlogs(data.content, grid);
        renderPagination(data);
        
        // Results Count Header
        const resultsHeader = document.getElementById('feed-results-count');
        if (state.searchKeyword || state.selectedCategory || state.selectedTag) {
            resultsHeader.textContent = `Found ${data.totalElements} matches matching filters`;
        } else {
            resultsHeader.textContent = `Showing all publications (${data.totalElements})`;
        }
    } catch (err) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <p>Failed to connect to blogging service database. Please verify your connection credentials in application.properties.</p>
            </div>`;
    }
}

function renderBlogs(blogs, container) {
    container.innerHTML = '';
    
    if (!blogs || blogs.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-regular fa-folder-open"></i>
                <p>No publications found matching your search. Write the first one!</p>
            </div>`;
        return;
    }
    
    blogs.forEach(blog => {
        const card = document.createElement('article');
        card.className = 'blog-card glass-card';
        
        // Handle tags rendering
        let tagsHtml = '';
        if (blog.tags && blog.tags.length > 0) {
            blog.tags.forEach(tag => {
                tagsHtml += `<span class="blog-card-tag" onclick="event.stopPropagation(); filterByTag('${tag}')">#${tag}</span>`;
            });
        }
        
        const formattedDate = new Date(blog.createdAt).toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric'
        });
        
        card.innerHTML = `
            <div class="blog-card-body">
                <div class="blog-card-meta">
                    <span class="blog-card-badge" onclick="event.stopPropagation(); filterByCategory('${blog.categoryName}')">${blog.categoryName}</span>
                    <span class="blog-card-date">${formattedDate}</span>
                </div>
                <h3 class="blog-card-title">${escapeHtml(blog.title)}</h3>
                <p class="blog-card-summary">${escapeHtml(blog.summary)}</p>
                <div class="blog-card-tags">${tagsHtml}</div>
                <div class="blog-card-footer">
                    <div class="author-info" onclick="event.stopPropagation(); viewUserDashboard('${blog.authorUsername}')" style="cursor:pointer;">
                        <div class="author-avatar-sm">${blog.authorUsername.substring(0,2).toUpperCase()}</div>
                        <span>By ${blog.authorUsername}</span>
                    </div>
                    <div class="card-stats">
                        <span class="card-stat-item"><i class="fa-solid fa-heart ${blog.likedByCurrentUser ? 'liked' : ''}"></i> ${blog.likeCount}</span>
                    </div>
                </div>
            </div>`;
            
        // Event Listener to read blog
        card.querySelector('.blog-card-title').addEventListener('click', () => {
            readArticle(blog.id);
        });
        
        container.appendChild(card);
    });
}

// Feed filtering controllers
function filterByCategory(category) {
    state.selectedCategory = category;
    state.currentPage = 0;
    
    // Update active pill styling
    const pills = document.querySelectorAll('#category-pills-list .pill');
    pills.forEach(pill => {
        if (pill.getAttribute('data-category') === category) {
            pill.classList.add('active');
        } else {
            pill.classList.remove('active');
        }
    });
    
    loadFeed();
}

function filterByTag(tag) {
    state.selectedTag = tag;
    document.getElementById('tag-filter-input').value = tag;
    state.currentPage = 0;
    loadFeed();
}

// Pagination Builder
function renderPagination(pageData) {
    const prevBtn = document.getElementById('btn-prev-page');
    const nextBtn = document.getElementById('btn-next-page');
    const indicator = document.getElementById('page-number-indicator');
    const paginationRow = document.getElementById('pagination-controls');
    
    if (pageData.totalPages <= 1) {
        paginationRow.style.display = 'none';
        return;
    }
    
    paginationRow.style.display = 'flex';
    indicator.textContent = `Page ${pageData.number + 1} of ${pageData.totalPages}`;
    
    prevBtn.disabled = pageData.first;
    nextBtn.disabled = pageData.last;
}

// ================= ARTICLE DETAILS VIEW =================
async function readArticle(blogId) {
    state.activeBlogId = blogId;
    showView('article');
    
    const container = document.getElementById('article-details-container');
    container.innerHTML = `
        <div class="loading-state">
            <i class="fa-solid fa-spinner fa-spin loading-spinner"></i>
            <p>Formatting publication details...</p>
        </div>`;
        
    try {
        const blog = await apiCall(`/blogs/${blogId}`);
        renderArticle(blog, container);
        loadComments(blogId);
    } catch (err) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-exclamation-triangle"></i>
                <p>Failed to retrieve article details.</p>
            </div>`;
    }
}

function renderArticle(blog, container) {
    const formattedDate = new Date(blog.createdAt).toLocaleDateString(undefined, {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    
    let tagsHtml = '';
    if (blog.tags && blog.tags.length > 0) {
        blog.tags.forEach(tag => {
            tagsHtml += `<span class="blog-card-tag" onclick="filterByTag('${tag}')">#${tag}</span>`;
        });
    }
    
    // Check if the current logged-in user is the author
    let adminActionsHtml = '';
    if (state.username && blog.authorUsername === state.username) {
        adminActionsHtml = `
            <div class="article-admin-actions">
                <button class="btn btn-secondary btn-sm" id="btn-edit-article"><i class="fa-solid fa-file-pen"></i> Edit Article</button>
                <button class="btn btn-ghost btn-sm" id="btn-delete-article" style="color:var(--danger);"><i class="fa-solid fa-trash"></i> Delete Post</button>
            </div>`;
    }
    
    container.innerHTML = `
        <div class="article-header">
            <div class="article-meta-row">
                <div class="article-meta-left">
                    <span class="article-badge" onclick="filterByCategory('${blog.categoryName}')">${blog.categoryName}</span>
                    <div class="article-author-info" onclick="viewUserDashboard('${blog.authorUsername}')" style="cursor:pointer;">
                        <div class="author-avatar-md">${blog.authorUsername.substring(0,2).toUpperCase()}</div>
                        <div>
                            <div class="article-author-name">By ${blog.authorUsername}</div>
                            <div class="article-date">${formattedDate}</div>
                        </div>
                    </div>
                </div>
                
                <button class="btn-like-heart ${blog.likedByCurrentUser ? 'liked' : ''}" id="btn-like-trigger">
                    <i class="fa-solid fa-heart"></i>
                    <span id="like-count-num">${blog.likeCount}</span> Likes
                </button>
            </div>
            
            <div class="article-title-row">
                <h1 class="article-full-title">${escapeHtml(blog.title)}</h1>
            </div>
        </div>
        
        <div class="article-summary-hook">
            ${escapeHtml(blog.summary)}
        </div>
        
        <div class="article-body-content">
            ${blog.content}
        </div>
        
        <div class="article-tags-row">
            ${tagsHtml}
        </div>
        
        ${adminActionsHtml}`;
        
    // Bind Likes toggle listener
    const likeBtn = document.getElementById('btn-like-trigger');
    likeBtn.addEventListener('click', () => {
        if (!state.token) {
            showToast('You must login to like posts.', 'error');
            showModal(modalLogin);
            return;
        }
        toggleLikeArticle(blog.id);
    });
    
    // Bind Edit & Delete buttons if available
    const editBtn = document.getElementById('btn-edit-article');
    const deleteBtn = document.getElementById('btn-delete-article');
    
    if (editBtn) {
        editBtn.addEventListener('click', () => editArticleData(blog));
    }
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => deleteArticleData(blog.id));
    }
}

// Toggle Like logic
async function toggleLikeArticle(blogId) {
    try {
        const updatedBlog = await apiCall(`/blogs/${blogId}/like`, 'POST');
        const likeBtn = document.getElementById('btn-like-trigger');
        const likeCountText = document.getElementById('like-count-num');
        
        if (updatedBlog.likedByCurrentUser) {
            likeBtn.classList.add('liked');
            likeBtn.querySelector('i').classList.add('liked');
        } else {
            likeBtn.classList.remove('liked');
            likeBtn.querySelector('i').classList.remove('liked');
        }
        likeCountText.textContent = updatedBlog.likeCount;
    } catch (err) {
        showToast('Failed to toggling like.', 'error');
    }
}

// ================= ARTICLE COMMENTS MANAGEMENT =================
async function loadComments(blogId) {
    const list = document.getElementById('comments-list-container');
    list.innerHTML = `<i class="fa-solid fa-spinner fa-spin loading-spinner"></i>`;
    
    try {
        const comments = await apiCall(`/blogs/${blogId}/comments`);
        document.getElementById('comments-count').textContent = comments.length;
        renderComments(comments, list);
    } catch (err) {
        list.innerHTML = `<p class="text-muted">Failed to retrieve comments.</p>`;
    }
}

function renderComments(comments, container) {
    container.innerHTML = '';
    
    if (!comments || comments.length === 0) {
        container.innerHTML = `<p class="guest-prompt-box">No comments yet. Start the conversation!</p>`;
        return;
    }
    
    comments.forEach(comment => {
        const card = document.createElement('div');
        card.className = 'comment-card';
        
        const formattedDate = new Date(comment.createdAt).toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        
        // Allow comment deletion if:
        // 1. Current user is comment writer.
        // 2. Current user is the owner of the blog post (this requires state checks).
        // Since we check the server-side author username, we can compare it securely!
        let deleteBtnHtml = '';
        
        // Get author of article from DOM to compare (since it's flat inside the service, we can also query the blog author username if needed, but we can verify it directly in the backend!)
        const isUserAuthorized = state.token && (comment.authorUsername === state.username || document.querySelector('.article-author-name')?.textContent.includes(state.username));
        
        if (isUserAuthorized) {
            deleteBtnHtml = `<button class="btn-delete-comment" onclick="deleteCommentData(${comment.id})" title="Delete Comment"><i class="fa-solid fa-trash-can"></i></button>`;
        }
        
        card.innerHTML = `
            <div class="comment-author-avatar">${comment.authorUsername.substring(0, 2).toUpperCase()}</div>
            <div class="comment-main">
                <div class="comment-meta">
                    <span class="comment-author-name" onclick="viewUserDashboard('${comment.authorUsername}')" style="cursor:pointer;">${comment.authorUsername}</span>
                    <div style="display:flex; gap:12px; align-items:center;">
                        <span class="comment-date">${formattedDate}</span>
                        ${deleteBtnHtml}
                    </div>
                </div>
                <div class="comment-content">${escapeHtml(comment.content)}</div>
            </div>`;
            
        container.appendChild(card);
    });
}

async function handleCommentSubmit(e) {
    e.preventDefault();
    const commentInput = document.getElementById('comment-textarea');
    const content = commentInput.value.trim();
    
    if (!content) return;
    
    try {
        await apiCall(`/blogs/${state.activeBlogId}/comments`, 'POST', {
            content
        });
        
        commentInput.value = '';
        showToast('Comment posted successfully!', 'success');
        loadComments(state.activeBlogId);
    } catch (err) {
        showToast(err.content || 'Failed to submit comment.', 'error');
    }
}

async function deleteCommentData(commentId) {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    
    try {
        await apiCall(`/comments/${commentId}`, 'DELETE');
        showToast('Comment deleted.', 'success');
        loadComments(state.activeBlogId);
    } catch (err) {
        showToast('Failed to delete comment.', 'error');
    }
}

// ================= SPLIT-SCREEN EDITOR WRITER =================
function showWriter(isEdit = false) {
    showView('writer');
    const titleEl = document.getElementById('writer-view-title');
    const submitBtn = document.getElementById('btn-submit-post');
    const form = document.getElementById('blog-editor-form');
    
    if (!isEdit) {
        form.reset();
        document.getElementById('edit-blog-id').value = '';
        titleEl.innerHTML = `<i class="fa-solid fa-pen-nib"></i> Write new publication`;
        submitBtn.textContent = 'Publish Story';
        
        // Sync Empty Preview
        syncLivePreview();
    }
}

function syncLivePreview() {
    const title = document.getElementById('blog-title').value || 'Your Publication Title';
    const summary = document.getElementById('blog-summary').value || 'Your publication summary hook will appear here.';
    const content = document.getElementById('blog-content').value || 'Start writing to see your story take shape...';
    const category = document.getElementById('blog-category').value || 'General';
    const tagsInput = document.getElementById('blog-tags').value;
    
    document.getElementById('prev-title').textContent = title;
    document.getElementById('prev-summary').textContent = summary;
    document.getElementById('prev-category').textContent = category;
    document.getElementById('prev-body').innerHTML = content; // Can take raw text or HTML formatting
    
    const tagsContainer = document.getElementById('prev-tags');
    tagsContainer.innerHTML = '';
    if (tagsInput) {
        const tags = tagsInput.split(',');
        tags.forEach(tag => {
            const trimmed = tag.trim();
            if (trimmed) {
                const tagSpan = document.createElement('span');
                tagSpan.className = 'blog-card-tag';
                tagSpan.textContent = `#${trimmed}`;
                tagsContainer.appendChild(tagSpan);
            }
        });
    }
}

function editArticleData(blog) {
    showWriter(true);
    
    document.getElementById('writer-view-title').innerHTML = `<i class="fa-solid fa-file-pen"></i> Edit publication`;
    document.getElementById('btn-submit-post').textContent = 'Save Changes';
    
    document.getElementById('edit-blog-id').value = blog.id;
    document.getElementById('blog-title').value = blog.title;
    document.getElementById('blog-summary').value = blog.summary;
    document.getElementById('blog-category').value = blog.categoryName;
    document.getElementById('blog-content').value = blog.content;
    
    // Map tag set back to comma-separated string
    const tagsString = blog.tags ? Array.from(blog.tags).join(', ') : '';
    document.getElementById('blog-tags').value = tagsString;
    
    syncLivePreview();
}

async function handleBlogSubmit(e) {
    e.preventDefault();
    
    const blogId = document.getElementById('edit-blog-id').value;
    const title = document.getElementById('blog-title').value.trim();
    const summary = document.getElementById('blog-summary').value.trim();
    const content = document.getElementById('blog-content').value;
    const categoryName = document.getElementById('blog-category').value.trim();
    
    // Process tags
    const tagsInput = document.getElementById('blog-tags').value;
    const tags = new Set();
    if (tagsInput) {
        tagsInput.split(',').forEach(t => {
            const trimmed = t.trim();
            if (trimmed) tags.add(trimmed);
        });
    }
    
    const payload = {
        title,
        summary,
        content,
        categoryName,
        tags: Array.from(tags)
    };
    
    try {
        if (blogId) {
            // Update
            await apiCall(`/blogs/${blogId}`, 'PUT', payload);
            showToast('Publication updated successfully!', 'success');
            readArticle(blogId);
        } else {
            // Create
            const newPost = await apiCall('/blogs', 'POST', payload);
            showToast('Publication published successfully!', 'success');
            readArticle(newPost.id);
        }
    } catch (err) {
        showToast('Validation failed: ' + (err.message || 'Check your fields.'), 'error');
    }
}

async function deleteArticleData(blogId) {
    if (!confirm('CAUTION: Are you sure you want to permanently delete this publication? This action is irreversible.')) return;
    
    try {
        await apiCall(`/blogs/${blogId}`, 'DELETE');
        showToast('Publication successfully deleted.', 'success');
        showView('feed');
        loadFeed();
    } catch (err) {
        showToast('Failed to delete blog post.', 'error');
    }
}

// ================= USER STATS PROFILE DASHBOARD =================
async function viewUserDashboard(usernameStr) {
    showView('profile');
    
    const avatar = document.getElementById('profile-avatar');
    const userTitle = document.getElementById('profile-username');
    const userEmail = document.getElementById('profile-email');
    const userBadge = document.getElementById('profile-badge');
    const statPosts = document.getElementById('profile-stat-posts');
    const statLikes = document.getElementById('profile-stat-likes');
    const gridContainer = document.getElementById('profile-blogs-grid');
    
    gridContainer.innerHTML = `<i class="fa-solid fa-spinner fa-spin loading-spinner"></i>`;
    
    try {
        // Load public user profile analytics details
        const profile = await apiCall(`/users/profile/${usernameStr}`);
        
        avatar.textContent = profile.username.substring(0, 2).toUpperCase();
        userTitle.textContent = profile.username;
        userEmail.textContent = profile.email;
        userBadge.textContent = profile.role;
        statPosts.textContent = profile.totalPosts;
        statLikes.textContent = profile.totalLikesReceived;
        
        // Load authored blogs of that specific user
        const authoredBlogs = await apiCall(`/blogs/author/${profile.id}?size=100`);
        renderBlogs(authoredBlogs.content, gridContainer);
    } catch (err) {
        userTitle.textContent = 'User Dashboard';
        userEmail.textContent = 'Account profile could not be loaded.';
        gridContainer.innerHTML = '<p class="text-muted">Failed to query public posts list.</p>';
    }
}

// ================= MODALS OVERLAYS SYSTEM =================
function showModal(modalElement) {
    modalBackdrop.classList.add('active');
    modalElement.classList.add('active');
}

function hideModals() {
    modalBackdrop.classList.remove('active');
    modalLogin.classList.remove('active');
    modalRegister.classList.remove('active');
    
    // Clear error messages
    loginError.style.display = 'none';
    registerError.style.display = 'none';
}

// ================= EVENT BINDINGS REGISTER =================
function setupEventListeners() {
    // Nav bar clicks
    document.getElementById('brand-logo').addEventListener('click', (e) => {
        e.preventDefault();
        // Clear filters
        state.currentPage = 0;
        state.searchKeyword = '';
        state.selectedCategory = '';
        state.selectedTag = '';
        document.getElementById('search-input').value = '';
        document.getElementById('tag-filter-input').value = '';
        
        // Reset pills
        const pills = document.querySelectorAll('#category-pills-list .pill');
        pills.forEach((p, idx) => {
            if (idx === 0) p.classList.add('active');
            else p.classList.remove('active');
        });
        
        showView('feed');
        loadFeed();
    });
    
    document.getElementById('btn-create-post').addEventListener('click', () => showWriter(false));
    document.getElementById('btn-my-profile').addEventListener('click', () => viewUserDashboard(state.username));
    document.getElementById('btn-logout').addEventListener('click', logout);
    
    // Guest button triggers
    document.getElementById('btn-show-login').addEventListener('click', () => showModal(modalLogin));
    document.getElementById('btn-show-register').addEventListener('click', () => showModal(modalRegister));
    
    // Toggle switch inside modals
    document.getElementById('link-show-register').addEventListener('click', (e) => {
        e.preventDefault();
        hideModals();
        showModal(modalRegister);
    });
    document.getElementById('link-show-login').addEventListener('click', (e) => {
        e.preventDefault();
        hideModals();
        showModal(modalLogin);
    });
    
    document.getElementById('link-comment-login').addEventListener('click', (e) => {
        e.preventDefault();
        showModal(modalLogin);
    });
    
    // Modal close binds
    document.getElementById('btn-close-login').addEventListener('click', hideModals);
    document.getElementById('btn-close-register').addEventListener('click', hideModals);
    modalBackdrop.addEventListener('click', hideModals);
    
    // Form submits
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    document.getElementById('comment-submit-form').addEventListener('submit', handleCommentSubmit);
    document.getElementById('blog-editor-form').addEventListener('submit', handleBlogSubmit);
    
    // Feed search triggers
    document.getElementById('btn-search').addEventListener('click', () => {
        state.searchKeyword = document.getElementById('search-input').value;
        state.currentPage = 0;
        loadFeed();
    });
    document.getElementById('search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            state.searchKeyword = document.getElementById('search-input').value;
            state.currentPage = 0;
            loadFeed();
        }
    });
    
    // Tag filter input keyup
    document.getElementById('tag-filter-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            state.selectedTag = document.getElementById('tag-filter-input').value;
            state.currentPage = 0;
            loadFeed();
        }
    });
    
    // Category pill bindings
    const pills = document.querySelectorAll('#category-pills-list .pill');
    pills.forEach(pill => {
        pill.addEventListener('click', () => {
            const cat = pill.getAttribute('data-category');
            filterByCategory(cat);
        });
    });
    
    // Pagination bindings
    document.getElementById('btn-prev-page').addEventListener('click', () => {
        if (state.currentPage > 0) {
            state.currentPage--;
            loadFeed();
        }
    });
    document.getElementById('btn-next-page').addEventListener('click', () => {
        state.currentPage++;
        loadFeed();
    });
    
    // Detail View controls
    document.getElementById('btn-back-to-feed').addEventListener('click', () => {
        showView('feed');
        loadFeed();
    });
    
    // Writer Cancel Trigger
    document.getElementById('btn-cancel-write').addEventListener('click', () => {
        if (state.activeBlogId) {
            readArticle(state.activeBlogId);
        } else {
            showView('feed');
            loadFeed();
        }
    });
    
    // Live Preview sync listeners
    const fields = ['blog-title', 'blog-summary', 'blog-category', 'blog-tags', 'blog-content'];
    fields.forEach(fieldId => {
        document.getElementById(fieldId).addEventListener('input', syncLivePreview);
    });
}

// ================= UTILITIES =================
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}
