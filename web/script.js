function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatMessage(message) {
    return `
        <div class="message">
            <div class="message-text">${escapeHtml(message.text)}</div>
            <div class="message-info">
                <span class="message-ip">From: ${escapeHtml(message.ip_address)}</span>
                <span class="message-timestamp">${new Date(message.timestamp).toLocaleString()}</span>
            </div>
        </div>
    `;
}

async function fetchMessages() {
    try {
        const response = await fetch('/api/messages');
        const messages = await response.json();
        document.getElementById('messages').innerHTML = 
            messages.map(message => formatMessage(message)).join('');
    } catch (error) {
        console.error('Error:', error);
    }
}

async function postMessage(event) {
    event.preventDefault();
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    
    if (message) {
        try {
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
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('message-form').addEventListener('submit', postMessage);
    fetchMessages();
    setInterval(fetchMessages, 5000); // Fetch messages every 5 seconds
}); 