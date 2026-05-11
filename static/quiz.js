async function fetchQuiz() {
    const response = await fetch(`/api/quiz/${window.QUIZ_ID}`);
    if (!response.ok) {
        throw new Error('failed to load quiz');
    }
    return response.json();
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function renderQuiz(quiz) {
    const root = document.getElementById('quiz-root');
    const countTag = document.getElementById('question-count');
    const statusText = document.getElementById('status-text');

    countTag.textContent = `题目 ${quiz.questions.length} 道`;
    statusText.textContent = '请选择答案后提交。';

    root.innerHTML = quiz.questions.map((item, index) => {
        const options = (item.options || []).map((option, optionIndex) => {
            const code = option.label || String.fromCharCode(65 + optionIndex);
            const inputId = `q${index}-${code}`;
            return `
                <label class="option-row" for="${inputId}">
                    <input type="radio" id="${inputId}" name="q${index}" value="${escapeHtml(code)}">
                    <strong>${escapeHtml(code)}.</strong> ${escapeHtml(option.text)}
                </label>
            `;
        }).join('');

        return `
            <section class="question-card">
                <div class="question-head">
                    <div class="question-index">${escapeHtml(item.number || index + 1)}</div>
                    <div class="question-text">${escapeHtml(item.stem)}</div>
                </div>
                <div class="option-list">${options}</div>
            </section>
        `;
    }).join('');

    function selectedCount() {
        return quiz.questions.reduce((total, _, index) => {
            return total + (document.querySelector(`input[name="q${index}"]:checked`) ? 1 : 0);
        }, 0);
    }

    document.getElementById('submit-btn').addEventListener('click', () => {
        statusText.textContent = `你已经选择了 ${selectedCount()} / ${quiz.questions.length} 题。`;
    });

    document.getElementById('reset-btn').addEventListener('click', () => {
        document.querySelectorAll('input[type="radio"]').forEach(input => {
            input.checked = false;
        });
        statusText.textContent = '已重置选择。';
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const quiz = await fetchQuiz();
        renderQuiz(quiz);
    } catch (error) {
        const root = document.getElementById('quiz-root');
        const statusText = document.getElementById('status-text');
        const countTag = document.getElementById('question-count');
        if (root) {
            root.innerHTML = '<div class="panel">题目加载失败。</div>';
        }
        if (countTag) {
            countTag.textContent = '题目 0 道';
        }
        if (statusText) {
            statusText.textContent = '题目加载失败。';
        }
    }
});
