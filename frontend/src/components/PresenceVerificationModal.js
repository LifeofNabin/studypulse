import React, { useState, useEffect, useCallback } from 'react';

const PresenceVerificationModal = ({ isOpen, onVerified, onFailed, sessionSubject }) => {
  const [question, setQuestion] = useState(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(30);
  const [attempts, setAttempts] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  // 🔹 All question types
  const questionTypes = {
    math: [
      () => {
        const a = Math.floor(Math.random() * 50) + 10;
        const b = Math.floor(Math.random() * 50) + 10;
        return {
          question: `What is ${a} + ${b}?`,
          answer: (a + b).toString(),
          type: 'math'
        };
      },
      () => {
        const a = Math.floor(Math.random() * 20) + 5;
        const b = Math.floor(Math.random() * 12) + 2;
        return {
          question: `What is ${a} × ${b}?`,
          answer: (a * b).toString(),
          type: 'math'
        };
      },
      () => {
        const a = Math.floor(Math.random() * 100) + 50;
        const b = Math.floor(Math.random() * 30) + 10;
        return {
          question: `What is ${a} - ${b}?`,
          answer: (a - b).toString(),
          type: 'math'
        };
      }
    ],

    logic: [
      () => {
        const sequences = [
          { seq: [2, 4, 6, 8], next: 10 },
          { seq: [5, 10, 15, 20], next: 25 },
          { seq: [1, 4, 9, 16], next: 25 },
          { seq: [3, 6, 12, 24], next: 48 },
          { seq: [10, 20, 30, 40], next: 50 }
        ];
        const selected = sequences[Math.floor(Math.random() * sequences.length)];
        return {
          question: `What comes next? ${selected.seq.join(', ')}, ?`,
          answer: selected.next.toString(),
          type: 'logic'
        };
      },
      () => {
        const patterns = [
          { question: "If all cats are animals, and some animals are pets, are all cats pets?", answer: "no" },
          { question: "A bat and a ball cost $1.10. The bat costs $1 more than the ball. How much does the ball cost?", answer: "0.05" },
          { question: "How many months have 28 days?", answer: "12" }
        ];
        const selected = patterns[Math.floor(Math.random() * patterns.length)];
        return { question: selected.question, answer: selected.answer, type: 'logic' };
      }
    ],

    trivia: [
      () => {
        const facts = [
          { q: "What is the capital of France?", a: "paris" },
          { q: "What is 2 to the power of 3?", a: "8" },
          { q: "How many continents are there?", a: "7" },
          { q: "What color do you get when you mix red and blue?", a: "purple" },
          { q: "How many sides does a hexagon have?", a: "6" }
        ];
        const selected = facts[Math.floor(Math.random() * facts.length)];
        return { question: selected.q, answer: selected.a, type: 'trivia' };
      }
    ],

    attention: [
      () => {
        const words = ["FOCUS", "STUDY", "LEARN", "THINK", "READ"];
        const word = words[Math.floor(Math.random() * words.length)];
        return {
          question: `Type this word exactly: ${word}`,
          answer: word.toLowerCase(),
          type: 'attention',
          caseSensitive: false
        };
      },
      () => {
        const colors = ["red", "blue", "green", "yellow", "purple"];
        const color = colors[Math.floor(Math.random() * colors.length)];
        return {
          question: `What color is mentioned here: "The sky is ${color}"?`,
          answer: color,
          type: 'attention'
        };
      }
    ],

    subjectBased: [
      () => {
        const subjectQuestions = {
          mathematics: [
            { q: "What is the square root of 64?", a: "8" },
            { q: "What is 15% of 200?", a: "30" }
          ],
          science: [
            { q: "What is the chemical symbol for water?", a: "h2o" },
            { q: "How many bones are in the human body?", a: "206" }
          ],
          english: [
            { q: "What is the plural of 'mouse'?", a: "mice" },
            { q: "What is a synonym for 'happy'?", a: "joyful" }
          ]
        };

        const subject = (sessionSubject || 'mathematics').toLowerCase();
        const questions = subjectQuestions[subject] || subjectQuestions.mathematics;
        const selected = questions[Math.floor(Math.random() * questions.length)];

        return { question: selected.q, answer: selected.a, type: 'subject' };
      }
    ]
  };

  // 🔹 Generate question
  const generateQuestion = useCallback(() => {
    const types = Object.keys(questionTypes);
    const randomType = types[Math.floor(Math.random() * types.length)];
    const generators = questionTypes[randomType];
    const generator = generators[Math.floor(Math.random() * generators.length)];
    const newQuestion = generator();
    setQuestion(newQuestion);
    setUserAnswer('');
    setTimeLeft(30);
    setShowFeedback(false);
  }, []);

  // 🔹 Initialize
  useEffect(() => {
    if (isOpen) {
      generateQuestion();
      setAttempts(0);
    }
  }, [isOpen, generateQuestion]);

  // 🔹 Timer countdown
  useEffect(() => {
    if (!isOpen || timeLeft <= 0 || showFeedback) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, timeLeft, showFeedback]);

  const handleTimeout = () => {
    setShowFeedback(true);
    setIsCorrect(false);
    setTimeout(() => onFailed('timeout'), 2000);
  };

  const checkAnswer = () => {
    if (!question || !userAnswer.trim()) return;

    const userAns = userAnswer.trim().toLowerCase();
    const correctAns = question.answer.toLowerCase();
    const correct = question.caseSensitive === false
      ? userAns === correctAns
      : userAnswer.trim() === question.answer;

    setIsCorrect(correct);
    setShowFeedback(true);

    if (correct) {
      setTimeout(() => {
        onVerified({
          question: question.question,
          answer: userAnswer,
          timeSpent: 30 - timeLeft,
          attempts: attempts + 1
        });
      }, 1500);
    } else {
      setAttempts(prev => prev + 1);
      if (attempts >= 2) {
        setTimeout(() => onFailed('incorrect_answer'), 2000);
      } else {
        setTimeout(() => {
          setShowFeedback(false);
          setUserAnswer('');
        }, 1500);
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !showFeedback) checkAnswer();
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.titleGroup}>
            <div style={styles.iconBox}>🎯</div>
            <div>
              <h2 style={styles.title}>Presence Check</h2>
              <p style={styles.subtitle}>Answer to continue studying</p>
            </div>
          </div>
          <div style={styles.timerBox}>
            <div style={{
              ...styles.timerCircle,
              borderColor: timeLeft < 10 ? '#ef4444' : '#3b82f6',
              background: timeLeft < 10 ? '#fee2e2' : '#e0f2fe',
              color: timeLeft < 10 ? '#ef4444' : '#3b82f6'
            }}>
              {timeLeft}
            </div>
            <span style={styles.timerLabel}>seconds</span>
          </div>
        </div>

        {/* Question */}
        <div style={styles.questionBox}>
          <div style={styles.questionCount}>Question {attempts + 1}/3</div>
          <p style={styles.questionText}>{question?.question}</p>
        </div>

        {/* Input */}
        <div style={{ marginBottom: '24px' }}>
          <label style={styles.label}>Your Answer:</label>
          <input
            type="text"
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={showFeedback}
            autoFocus
            placeholder="Type your answer here..."
            style={{
              ...styles.input,
              background: showFeedback ? '#f3f4f6' : 'white'
            }}
          />
        </div>

        {/* Feedback */}
        {showFeedback && (
          <div style={{
            ...styles.feedbackBox,
            background: isCorrect ? '#d1fae5' : '#fee2e2',
            borderColor: isCorrect ? '#22c55e' : '#ef4444'
          }}>
            <div style={styles.feedbackContent}>
              <span style={{ fontSize: '24px' }}>{isCorrect ? '✅' : '❌'}</span>
              <div>
                <div style={{
                  fontWeight: '700',
                  color: isCorrect ? '#065f46' : '#991b1b',
                  fontSize: '1.1rem'
                }}>
                  {isCorrect ? 'Correct!' : 'Incorrect'}
                </div>
                <div style={{
                  fontSize: '0.9rem',
                  color: isCorrect ? '#065f46' : '#991b1b',
                  opacity: 0.8
                }}>
                  {isCorrect
                    ? 'Great job! Continuing session...'
                    : attempts >= 2
                      ? 'Session will be paused for review.'
                      : `Try again. ${2 - attempts} attempts remaining.`}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        {!showFeedback && (
          <button
            onClick={checkAnswer}
            disabled={!userAnswer.trim()}
            style={{
              ...styles.button,
              background: !userAnswer.trim()
                ? '#9ca3af'
                : 'linear-gradient(135deg, #667eea, #764ba2)',
              cursor: !userAnswer.trim() ? 'not-allowed' : 'pointer'
            }}
          >
            Submit Answer
          </button>
        )}

        {/* Footer */}
        <div style={styles.footerInfo}>
          💡 This verification ensures you're actively engaged in your study session.
        </div>
      </div>
    </div>
  );
};

// 🔹 Inline styles (cleaned)
const styles = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0, 0, 0, 0.8)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 10000
  },
  modal: {
    background: 'white', borderRadius: '20px', padding: '40px',
    maxWidth: '600px', width: '90%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
  },
  header: { display: 'flex', justifyContent: 'space-between', marginBottom: 24 },
  titleGroup: { display: 'flex', alignItems: 'center', gap: 12 },
  iconBox: {
    width: 50, height: 50, borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea, #764ba2)', fontSize: 24
  },
  title: { margin: 0, fontSize: '1.5rem', color: '#1a1a2e' },
  subtitle: { margin: '4px 0 0', color: '#6b7280', fontSize: '0.9rem' },
  timerBox: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  timerCircle: {
    width: 60, height: 60, borderRadius: '50%',
    border: '4px solid', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: '1.5rem', fontWeight: '700'
  },
  timerLabel: { fontSize: '0.75rem', color: '#6b7280', marginTop: 4 },
  questionBox: {
    background: '#f9fafb', padding: 24, borderRadius: 12,
    marginBottom: 24, border: '2px solid #e5e7eb'
  },
  questionCount: {
    fontSize: '0.85rem', color: '#6b7280', marginBottom: 8,
    textTransform: 'uppercase', fontWeight: 600
  },
  questionText: {
    fontSize: '1.2rem', fontWeight: 600, color: '#1a1a2e', margin: 0
  },
  label: {
    display: 'block', fontSize: '0.9rem', fontWeight: 600,
    color: '#374151', marginBottom: 8
  },
  input: {
    width: '100%', padding: '14px', fontSize: '1.1rem',
    border: '2px solid #e5e7eb', borderRadius: '10px', outline: 'none'
  },
  feedbackBox: {
    padding: 16, borderRadius: 10, marginBottom: 20, border: '2px solid'
  },
  feedbackContent: { display: 'flex', alignItems: 'center', gap: 12 },
  button: {
    width: '100%', padding: 16, color: 'white', border: 'none',
    borderRadius: 12, fontSize: '1.1rem', fontWeight: 700
  },
  footerInfo: {
    marginTop: 20, padding: 12, background: '#eff6ff',
    borderRadius: 8, fontSize: '0.85rem', color: '#1e40af'
  }
};

export default PresenceVerificationModal;
