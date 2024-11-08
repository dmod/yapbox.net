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
                showFeedbackAnimation();
            } else {
                throw new Error('Failed to post message');
            }
        } catch (error) {
            console.error('Error:', error);
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