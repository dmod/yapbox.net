function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Add this function to generate a consistent color from a string (IP address)
function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Generate fun, vibrant colors that are still readable
    const hue = hash % 360;  // Full hue range
    const saturation = 45 + (hash % 30);  // 45-75% saturation - more vibrant
    const lightness = 80 + (hash % 12);   // 80-92% lightness - keeping it readable

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function formatMessage(message) {
    const backgroundColor = stringToColor(message.ip_address);
    return `
        <div class="message" id="${message.id}" style="background-color: ${backgroundColor}">
            <div class="message-text">${escapeHtml(message.text)}</div>
            <div class="message-info">
                <div class="message-meta">
                    <a href="#${message.id}" class="message-number">#${message.id}</a>
                    <span class="message-ip"> - From ${escapeHtml(message.ip_address)}</span>
                </div>
                <span class="message-timestamp">${new Date(message.timestamp).toLocaleString()}</span>
            </div>
        </div>
    `;
}

let isSubmitting = false;
let currentMessages = [];
let searchQuery = '';
let ws = null;
let scrollIndicatorHideTimer = null;
let otherYappers = 0;
let connectionStatus = 'disconnected'; // 'connected', 'disconnected', 'reconnecting'

let wsHasConnectedBefore = false;
let wsReconnectDelay = 1000;
const WS_RECONNECT_MAX_DELAY = 10000;

function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    console.log(`[WebSocket] Attempting to connect to ${wsUrl} (backoff: ${wsReconnectDelay}ms)`);

    if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onclose = null;
        ws.onerror = null;
    }

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('[WebSocket] Connection established');
        connectionStatus = 'connected';
        wsReconnectDelay = 1000;
        updateStatusIndicator();
        if (wsHasConnectedBefore) {
            console.log('[WebSocket] Reconnected \u2014 re-fetching messages to sync state');
            fetchMessages();
        }
        wsHasConnectedBefore = true;
    };

    ws.onmessage = (event) => {
        console.log('[WebSocket] Received raw message:', event.data);
        try {
            handleWebSocketUpdate(JSON.parse(event.data));
        } catch (error) {
            console.error('[WebSocket] Error processing message:', error);
        }
    };

    ws.onclose = (event) => {
        console.log(`[WebSocket] Connection closed (code: ${event.code}, reason: ${event.reason})`);
        connectionStatus = 'reconnecting';
        updateStatusIndicator();
        console.log(`[WebSocket] Scheduling reconnect in ${wsReconnectDelay}ms`);
        setTimeout(connectWebSocket, wsReconnectDelay);
        wsReconnectDelay = Math.min(wsReconnectDelay * 2, WS_RECONNECT_MAX_DELAY);
    };

    ws.onerror = (error) => {
        console.error('[WebSocket] Connection error:', error);
        connectionStatus = 'disconnected';
        updateStatusIndicator();
    };
}

function handleWebSocketUpdate(update) {
    console.log(`[WebSocket] Processing update of type: ${update.type}`);
    switch (update.type) {
        case 'new':
            console.log('[WebSocket] Adding new message:', update.data);
            currentMessages.unshift(update.data);
            document.getElementById('messages').insertAdjacentHTML('afterbegin', formatMessage(update.data));
            updateMessageCount(currentMessages.length);
            showFeedbackAnimation();
            refreshIdScaleLabels();
            scheduleScrollIndicatorUpdate();
            console.log('[WebSocket] New message added successfully');
            break;

        case 'delete':
            const deleteId = Number(update.data.id);
            console.log(`[WebSocket] Removing message with ID: ${deleteId}`);
            currentMessages = currentMessages.filter(msg => msg.id !== deleteId);
            document.getElementById(String(deleteId))?.remove();
            updateMessageCount(currentMessages.length);
            refreshIdScaleLabels();
            scheduleScrollIndicatorUpdate();
            console.log('[WebSocket] Message deletion processed');
            break;

        case 'presence':
            console.log(`[WebSocket] Presence update: ${update.data.count} other yappers`);
            otherYappers = update.data.count;
            updateStatusIndicator();
            break;

        default:
            console.warn(`[WebSocket] Unknown update type received: ${update.type}`);
    }
}

function updateStatusIndicator() {
    const dot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const yappersText = document.getElementById('yappers-count');

    if (!dot || !statusText || !yappersText) return;

    // Update connection dot and text
    dot.className = 'status-dot ' + connectionStatus;
    statusText.textContent = connectionStatus === 'connected' ? 'connected' :
        connectionStatus === 'reconnecting' ? 'reconnecting' : 'disconnected';

    // Update yappers count
    const noun = otherYappers === 1 ? 'yapper' : 'yappers';
    yappersText.textContent = `${otherYappers} other ${noun} around`;
}

function updateMessageCount(count) {
    const countElement = document.getElementById('message-count');
    const oldCount = parseInt(countElement.textContent);
    
    if (oldCount !== count) {
        countElement.textContent = count;
        const sloganElement = document.querySelector('.slogan');
        sloganElement.classList.remove('jiggle');
        void sloganElement.offsetWidth; // Force reflow
        sloganElement.classList.add('jiggle');
    }
}

function filterMessages() {
    const query = searchQuery.toLowerCase();
    const messagesContainer = document.getElementById('messages');
    const messageElements = messagesContainer.getElementsByClassName('message');
    const statusBar = document.querySelector('.status-bar');
    const resultsCountElement = document.querySelector('.search-results-count');
    let visibleCount = 0;

    for (const messageEl of messageElements) {
        const messageText = messageEl.querySelector('.message-text').textContent.toLowerCase();
        const messageIp = messageEl.querySelector('.message-ip').textContent.toLowerCase();
        
        if (query === '' || messageText.includes(query) || messageIp.includes(query)) {
            messageEl.classList.remove('filtered-out');
            visibleCount++;
        } else {
            messageEl.classList.add('filtered-out');
        }
    }

    // Update search container classes and results count
    if (query) {
        statusBar.classList.add('has-query');
        resultsCountElement.textContent = `${visibleCount} result${visibleCount !== 1 ? 's' : ''} found`;
    } else {
        statusBar.classList.remove('has-query');
        resultsCountElement.textContent = '';
    }

    // Update indicators since visibility changed
    refreshIdScaleLabels();
    scheduleScrollIndicatorUpdate();
}

async function fetchMessages() {
    const messagesDiv = document.getElementById('messages');
    try {
        console.log('[API] Fetching initial messages');
        const response = await fetch('/api/messages');
        currentMessages = await response.json();
        console.log(`[API] Received ${currentMessages.length} messages`);
        messagesDiv.innerHTML = currentMessages.map(formatMessage).join('');
        filterMessages();
        updateMessageCount(currentMessages.length);
        refreshIdScaleLabels();
        scheduleScrollIndicatorUpdate();
        console.log('[API] Initial messages loaded and displayed');
    } catch (error) {
        console.error('[API] Error fetching messages:', error);
        messagesDiv.innerHTML = 'Error loading messages. Please try again.';
        throw error;
    }
}

// Add this array at the top with your other functions
const feedbackMessages = [
    "nice", "good one", "woah", "you are good at this ;)", "sweet",
    "omg", "mood.", "so good ;)", "😩", "great!", "neat", "slay", "king"
];

// Add this function to create and animate the feedback
function showFeedbackAnimation() {
    const message = feedbackMessages[Math.floor(Math.random() * feedbackMessages.length)];
    const element = document.createElement('div');
    element.className = 'feedback-animation';
    element.textContent = message;

    // Random position within viewport
    const x = Math.random() * (window.innerWidth - 200);
    const y = Math.random() * (window.innerHeight - 100);

    // Random rotation between -20 and 20 degrees
    const rotation = (Math.random() - 0.5) * 40;

    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    element.style.setProperty('--rotation', `${rotation}deg`);  // Set CSS variable for rotation

    document.body.appendChild(element);

    // Remove element after animation
    element.addEventListener('animationend', () => {
        element.remove();
    });
}

// Function to handle anchor link navigation with smooth scrolling
function handleAnchorNavigation() {
    const hash = window.location.hash;
    if (hash && hash.match(/^#\d+$/)) { // Check if hash is just a number
        const messageId = hash.substring(1); // Remove the # symbol
        const targetElement = document.getElementById(messageId);
        if (targetElement) {
            // Smooth scroll to the target message
            targetElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
            });
            
            // Add a highlight animation to make it obvious
            targetElement.classList.add('message-highlighted');
            setTimeout(() => {
                targetElement.classList.remove('message-highlighted');
            }, 5000); // 5 seconds to match the CSS animation
        }
    }
}

async function postMessage(event) {
    event.preventDefault();

    if (isSubmitting) return;

    const form = document.getElementById('message-form');
    const input = document.getElementById('message-input');
    const message = input.value.trim();

    if (message) {
        try {
            console.log('[API] Submitting new message');
            console.log(`[API] WebSocket state: ${ws ? ws.readyState : 'no ws object'} (0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)`);
            isSubmitting = true;
            form.classList.add('form-disabled');

            const response = await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message }),
            });

            if (response.ok) {
                console.log('[API] Message submitted successfully \u2014 waiting for WebSocket broadcast');
                input.value = '';
                if (!ws || ws.readyState !== WebSocket.OPEN) {
                    console.warn('[API] WebSocket is not open \u2014 message was saved but may not appear until reconnect. Re-fetching messages.');
                    fetchMessages();
                }
            } else {
                throw new Error(`Failed to post message (status: ${response.status})`);
            }
        } catch (error) {
            console.error('[API] Error submitting message:', error);
            alert('Failed to post message. Please try again.');
        } finally {
            isSubmitting = false;
            form.classList.remove('form-disabled');
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('message-form').addEventListener('submit', postMessage);
    
    // Add search container click handler
    const statusBar = document.querySelector('.status-bar');
    const searchIcon = document.querySelector('.search-icon');
    const searchInput = document.getElementById('search-input');

    searchIcon.addEventListener('click', () => {
        statusBar.classList.add('search-expanded');
        searchInput.focus();
    });

    // Close search when clicking outside
    document.addEventListener('click', (e) => {
        if (!statusBar.contains(e.target) && statusBar.classList.contains('search-expanded')) {
            if (!searchInput.value) {
                statusBar.classList.remove('search-expanded');
                statusBar.classList.remove('has-query');
            }
        }
    });

    // Add search input handler
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        filterMessages();
    });
    
    window.addEventListener('hashchange', handleAnchorNavigation);

    fetchMessages().then(() => {
        handleAnchorNavigation();
    }).catch((error) => {
        console.error('[Init] fetchMessages failed, will still connect WebSocket:', error);
    }).finally(() => {
        connectWebSocket();
    });

    // Scroll indicator setup
    setupScrollIndicator();
    window.addEventListener('resize', scheduleScrollIndicatorUpdate);
});

// Optional: Remove the animation class when it's done
document.querySelector('.slogan').addEventListener('animationend', function () {
    this.classList.remove('jiggle');
}); 

// =============== Scroll Indicator & ID Scale ===============
function getVisibleMessageIds() {
    const container = document.getElementById('messages');
    const containerRect = container.getBoundingClientRect();
    const ids = [];

    for (const el of container.getElementsByClassName('message')) {
        if (el.classList.contains('filtered-out')) continue;
        const rect = el.getBoundingClientRect();
        if (rect.bottom > containerRect.top && rect.top < containerRect.bottom) {
            const id = parseInt(el.id, 10);
            if (!Number.isNaN(id)) ids.push(id);
        }
    }

    ids.sort((a, b) => b.id - a.id);
    return ids;
}

function setupScrollIndicator() {
    const container = document.getElementById('messages');
    if (!container) return;
    container.addEventListener('scroll', () => {
        updateScrollIndicator();
        showScrollIndicatorTemporarily();
    }, { passive: true });
}

function scheduleScrollIndicatorUpdate() {
    // Defer to allow DOM layout to settle
    requestAnimationFrame(() => {
        updateScrollIndicator();
        positionScrollIndicator();
        positionIdScaleLabels();
    });
}

function updateScrollIndicator() {
    const indicator = document.getElementById('scroll-id-indicator');
    const ids = getVisibleMessageIds();
    if (!indicator) return;
    if (ids.length === 0) {
        indicator.textContent = '';
        indicator.classList.remove('visible');
        return;
    }
    // Choose the first visible message id (closest to top inside container)
    const currentId = ids[0];
    indicator.textContent = `#${currentId}`;
}

function showScrollIndicatorTemporarily() {
    const indicator = document.getElementById('scroll-id-indicator');
    if (!indicator) return;
    indicator.classList.add('visible');
    if (scrollIndicatorHideTimer) clearTimeout(scrollIndicatorHideTimer);
    scrollIndicatorHideTimer = setTimeout(() => {
        indicator.classList.remove('visible');
    }, 700);
}

function refreshIdScaleLabels() {
    const newestEl = document.getElementById('id-label-newest');
    const oldestEl = document.getElementById('id-label-oldest');
    const container = document.getElementById('messages');
    if (!newestEl || !oldestEl || !container) return;

    const elements = Array.from(container.getElementsByClassName('message'))
        .filter(el => !el.classList.contains('filtered-out'));
    if (elements.length === 0) {
        newestEl.textContent = '#';
        oldestEl.textContent = '#';
        return;
    }
    const ids = elements.map(el => parseInt(el.id, 10)).filter(n => !Number.isNaN(n));
    if (ids.length === 0) return;
    const newest = Math.max(...ids);
    const oldest = Math.min(...ids);
    newestEl.textContent = `#${newest}`;
    oldestEl.textContent = `#${oldest}`;
}

function positionScrollIndicator() {
    const indicator = document.getElementById('scroll-id-indicator');
    const container = document.getElementById('messages');
    if (!indicator || !container) return;
    const rect = container.getBoundingClientRect();

    // Place just inside the container's right edge, vertically centered
    const left = Math.round(rect.right - indicator.offsetWidth - 8);
    const top = Math.round(rect.top + rect.height / 2);
    indicator.style.left = `${left}px`;
    indicator.style.top = `${top}px`;
    indicator.style.right = '';
}

function positionIdScaleLabels() {
    const newestEl = document.getElementById('id-label-newest');
    const oldestEl = document.getElementById('id-label-oldest');
    const container = document.getElementById('messages');
    if (!newestEl || !oldestEl || !container) return;

    const rect = container.getBoundingClientRect();

    // Newest (top-right inside container)
    const newestLeft = Math.round(rect.right - newestEl.offsetWidth - 8);
    const newestTop = Math.round(rect.top + 8);
    newestEl.style.left = `${newestLeft}px`;
    newestEl.style.top = `${newestTop}px`;
    newestEl.style.right = '';
    newestEl.style.bottom = '';

    // Oldest (bottom-right inside container)
    const oldestLeft = Math.round(rect.right - oldestEl.offsetWidth - 8);
    const oldestTop = Math.round(rect.bottom - oldestEl.offsetHeight - 8);
    oldestEl.style.left = `${oldestLeft}px`;
    oldestEl.style.top = `${oldestTop}px`;
    oldestEl.style.right = '';
    oldestEl.style.bottom = '';
}