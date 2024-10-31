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
    // Generate pastel colors for better readability
    const h = hash % 360;
    return `hsl(${h}, 70%, 85%)`; // Pastel version
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

async function updateMessageCount() {
    try {
        const response = await fetch('/api/message-count');
        const data = await response.json();
        const countElement = document.getElementById('message-count');
        const oldCount = parseInt(countElement.textContent);
        const newCount = data.count;
        
        if (oldCount !== newCount) {
            countElement.textContent = newCount;
            const sloganElement = document.querySelector('.slogan');
            sloganElement.classList.remove('jiggle');
            void sloganElement.offsetWidth; // Force reflow
            sloganElement.classList.add('jiggle');
        }
    } catch (error) {
        console.error('Error fetching message count:', error);
    }
}

async function fetchMessages() {
    
    const messagesDiv = document.getElementById('messages');
    try {
        messagesDiv.classList.add('loading');
        
        const response = await fetch('/api/messages');
        const messages = await response.json();
        
        messagesDiv.innerHTML = messages.map(message => formatMessage(message)).join('');
        
        // Update the count separately
        await updateMessageCount();
    } catch (error) {
        console.error('Error:', error);
        messagesDiv.innerHTML = '<div class="messages-loading">Error loading messages. Please try again.</div>';
    }
}

async function postMessage(event) {
    event.preventDefault();

    if (isSubmitting) return; // Prevent multiple submissions

    const form = document.getElementById('message-form');
    const input = document.getElementById('message-input');
    const message = input.value.trim();

    if (message) {
        try {
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
                input.value = '';
                await fetchMessages();
            } else {
                throw new Error('Failed to post message');
            }
        } catch (error) {
            console.error('Error:', error);
            // Optionally show error to user
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
    fetchMessages();
    setInterval(fetchMessages, 5000);
});

// Optional: Remove the animation class when it's done
document.querySelector('.slogan').addEventListener('animationend', function () {
    this.classList.remove('jiggle');
}); 