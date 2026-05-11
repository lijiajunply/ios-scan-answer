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

function getSelectedAnswer(index) {
    const checked = document.querySelector(`input[name="q${index}"]:checked`);
    return checked ? checked.value : '';
}

function clearReviewState(root) {
    root.querySelectorAll('.question-card').forEach(card => {
        card.classList.remove('is-correct', 'is-wrong', 'is-unanswered');
        card.querySelectorAll('.option-row').forEach(label => {
            label.classList.remove('is-correct', 'is-selected', 'is-wrong');
        });
        const result = card.querySelector('.question-result');
        if (result) {
            result.textContent = '';
        }
    });
}

function renderQuiz(quiz) {
    const root = document.getElementById('quiz-root');
    const countTag = document.getElementById('question-count');
    const statusText = document.getElementById('status-text');
    const submitBtn = document.getElementById('submit-btn');

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
            <section class="question-card" data-question-index="${index}">
                <div class="question-head">
                    <div class="question-index">${escapeHtml(item.number || index + 1)}</div>
                    <div class="question-text">${escapeHtml(item.stem)}</div>
                </div>
                <div class="option-list">${options}</div>
                <div class="question-result" aria-live="polite"></div>
            </section>
        `;
    }).join('');

    async function reviewQuiz() {
        const answers = quiz.questions.map((item, index) => ({
            index,
            number: item.number,
            answer: getSelectedAnswer(index),
        }));

        submitBtn.disabled = true;
        submitBtn.textContent = '批改中...';

        try {
            const response = await fetch(`/api/quiz/${window.QUIZ_ID}/review`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ answers })
            });

            if (!response.ok) {
                throw new Error('failed to grade quiz');
            }

            const review = await response.json();
            clearReviewState(root);

            review.results.forEach(result => {
                const card = root.querySelector(`.question-card[data-question-index="${result.index}"]`);
                if (!card) {
                    return;
                }

                const selected = result.selected || '';
                const correct = result.correct || '';
                const selectedLabel = selected ? card.querySelector(`label[for="q${result.index}-${selected}"]`) : null;
                const correctLabel = correct ? card.querySelector(`label[for="q${result.index}-${correct}"]`) : null;

                if (selectedLabel) {
                    selectedLabel.classList.add('is-selected');
                }
                if (correctLabel) {
                    correctLabel.classList.add('is-correct');
                }
                if (selected && selected !== correct && selectedLabel) {
                    selectedLabel.classList.add('is-wrong');
                }

                card.classList.add(result.is_correct ? 'is-correct' : 'is-wrong');

                const resultText = card.querySelector('.question-result');
                if (resultText) {
                    if (!selected) {
                        resultText.textContent = `未作答，正确答案是 ${correct || '未知'}`;
                        card.classList.add('is-unanswered');
                    } else if (result.is_correct) {
                        resultText.textContent = `回答正确，答案是 ${correct || '未知'}`;
                    } else {
                        resultText.textContent = `回答错误，你选了 ${selected}，正确答案是 ${correct || '未知'}`;
                    }
                }
            });

            const percent = review.total ? Math.round((review.score / review.total) * 100) : 0;
            statusText.textContent = `已批改：${review.score} / ${review.total} 题，得分 ${percent} 分。`;
            submitBtn.textContent = '重新批改';
        } catch (error) {
            console.error(error);
            statusText.textContent = '批改失败，请稍后重试。';
            submitBtn.textContent = '提交';
        } finally {
            submitBtn.disabled = false;
        }
    }

    submitBtn.addEventListener('click', reviewQuiz);

    document.getElementById('reset-btn').addEventListener('click', () => {
        document.querySelectorAll('input[type="radio"]').forEach(input => {
            input.checked = false;
        });
        clearReviewState(root);
        statusText.textContent = '已重置选择。';
        submitBtn.textContent = '提交';
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
