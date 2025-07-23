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
        <div class="message" style="background-color: ${backgroundColor}">
            <div class="message-text">${escapeHtml(message.text)}</div>
            <div class="message-info">
                <div class="message-meta">
                    <span class="message-number">#${message.id}</span>
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

function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    console.log(`[WebSocket] Attempting to connect to ${protocol}//${window.location.host}`);
    
    ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onopen = () => {
        console.log('[WebSocket] Connection established');
    };

    ws.onmessage = (event) => {
        console.log('[WebSocket] Received message:', event.data);
        const update = JSON.parse(event.data);
        handleWebSocketUpdate(update);
    };

    ws.onclose = (event) => {
        console.log(`[WebSocket] Connection closed (code: ${event.code}, reason: ${event.reason})`);
        console.log('[WebSocket] Attempting to reconnect in 1 second...');
        setTimeout(connectWebSocket, 1000);
    };

    ws.onerror = (error) => {
        console.error('[WebSocket] Connection error:', error);
    };
}

function handleWebSocketUpdate(update) {
    console.log(`[WebSocket] Processing update of type: ${update.type}`);
    switch (update.type) {
        case 'new':
            console.log('[WebSocket] Adding new message:', update.data);
            // Add new message at the beginning
            currentMessages.unshift(update.data);
            const messagesDiv = document.getElementById('messages');
            const newMessageHtml = formatMessage(update.data);
            messagesDiv.insertAdjacentHTML('afterbegin', newMessageHtml);
            updateMessageCount(currentMessages.length);
            showFeedbackAnimation();
            console.log('[WebSocket] New message added successfully');
            break;
            
        case 'delete':
            console.log(`[WebSocket] Removing message with ID: ${update.data.id}`);
            // Remove deleted message
            currentMessages = currentMessages.filter(msg => msg.id !== update.data.id);
            const messageElement = document.querySelector(`.message[data-id="${update.data.id}"]`);
            if (messageElement) {
                messageElement.remove();
                console.log('[WebSocket] Message removed from DOM');
            } else {
                console.log('[WebSocket] Message element not found in DOM');
            }
            updateMessageCount(currentMessages.length);
            console.log('[WebSocket] Message deletion processed');
            break;
            
        default:
            console.warn(`[WebSocket] Unknown update type received: ${update.type}`);
    }
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
    const searchContainer = document.querySelector('.search-container');
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
        searchContainer.classList.add('has-query');
        resultsCountElement.textContent = `${visibleCount} result${visibleCount !== 1 ? 's' : ''} found`;
    } else {
        searchContainer.classList.remove('has-query');
        resultsCountElement.textContent = '';
    }
}

async function fetchMessages() {
    const messagesDiv = document.getElementById('messages');
    try {
        console.log('[API] Fetching initial messages');
        messagesDiv.classList.add('loading');

        const response = await fetch('/api/messages');
        currentMessages = await response.json();
        console.log(`[API] Received ${currentMessages.length} messages`);

        messagesDiv.innerHTML = currentMessages.map(message => formatMessage(message)).join('');
        filterMessages(); // Apply any existing filter

        // Update the count
        updateMessageCount(currentMessages.length);
        console.log('[API] Initial messages loaded and displayed');
    } catch (error) {
        console.error('[API] Error fetching messages:', error);
        messagesDiv.innerHTML = '<div class="messages-loading">Error loading messages. Please try again.</div>';
    } finally {
        messagesDiv.classList.remove('loading');
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

async function postMessage(event) {
    event.preventDefault();

    if (isSubmitting) return;

    const form = document.getElementById('message-form');
    const input = document.getElementById('message-input');
    const message = input.value.trim();

    if (message) {
        try {
            console.log('[API] Submitting new message');
            isSubmitting = true;
            form.classList.add('form-disabled');

            const response = await fetch('/api/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message }),
            });

            if (response.ok) {
                console.log('[API] Message submitted successfully');
                input.value = '';
            } else {
                throw new Error('Failed to post message');
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
    const searchContainer = document.querySelector('.search-container');
    const searchIcon = document.querySelector('.search-icon');
    const searchInput = document.getElementById('search-input');

    searchIcon.addEventListener('click', () => {
        searchContainer.classList.add('expanded');
        searchInput.focus();
    });

    // Close search when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchContainer.contains(e.target) && searchContainer.classList.contains('expanded')) {
            if (!searchInput.value) {
                searchContainer.classList.remove('expanded');
                searchContainer.classList.remove('has-query');
            }
        }
    });

    // Add search input handler
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        filterMessages();
    });
    
    // Initial load of messages
    fetchMessages();
    
    // Connect WebSocket
    connectWebSocket();
});

// Optional: Remove the animation class when it's done
document.querySelector('.slogan').addEventListener('animationend', function () {
    this.classList.remove('jiggle');
}); 