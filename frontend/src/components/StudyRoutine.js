import React, { useState } from "react";
import StudySession from "./StudySession";

// This is your "start session" form component
const StartStudySession = ({ onStartSession }) => {
  const [subject, setSubject] = useState("");
  const [duration, setDuration] = useState(30); // default 30 min
  const [showWarning, setShowWarning] = useState(false);

  const handleStart = () => {
    if (!subject || duration <= 0) {
      setShowWarning(true);
      return;
    }
    setShowWarning(false);
    onStartSession({ subject, duration });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-6">
      <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 max-w-md w-full shadow-xl border border-white/20">
        <h1 className="text-3xl font-bold text-white text-center mb-6">
          📚 Start Study Session
        </h1>

        {/* Subject Input */}
        <div className="mb-4">
          <label className="text-white font-semibold mb-2 block">Select Subject</label>
          <select
            className="w-full p-3 rounded-xl bg-white/20 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-400"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          >
            <option value="" disabled>Select a subject</option>
            <option value="Mathematics">Mathematics</option>
            <option value="Physics">Physics</option>
            <option value="Chemistry">Chemistry</option>
            <option value="Computer Science">Computer Science</option>
            <option value="English">English</option>
          </select>
        </div>

        {/* Duration Input */}
        <div className="mb-6">
          <label className="text-white font-semibold mb-2 block">Duration (minutes)</label>
          <input
            type="number"
            min="1"
            max="180"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full p-3 rounded-xl bg-white/20 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>

        {showWarning && (
          <p className="text-red-400 mb-4 text-center">Please select a subject and a valid duration!</p>
        )}

        {/* Start Button */}
        <button
          onClick={handleStart}
          className="w-full py-3 rounded-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 text-white text-lg shadow-lg transition-all transform hover:scale-105"
        >
          🚀 Start Session
        </button>

        {/* Info / Note */}
        <p className="mt-4 text-gray-300 text-sm text-center">
          Once the session starts, your study will be monitored via webcam for focus, posture, and eye contact.
        </p>
      </div>
    </div>
  );
};

// Main StudyRoutine component
const StudyRoutine = () => {
  const [activeSession, setActiveSession] = useState(null);

  // Called when user starts a session
  const handleStartSession = ({ subject, duration }) => {
    setActiveSession({ subject, duration });
  };

  // Called when user ends a session
  const handleEndSession = () => {
    setActiveSession(null);
  };

  return (
    <div className="study-routine min-h-screen">
      {!activeSession ? (
        <StartStudySession onStartSession={handleStartSession} />
      ) : (
        <StudySession
          subject={activeSession.subject}
          duration={activeSession.duration}
          onEndSession={handleEndSession}
        />
      )}
    </div>
  );
};

export default StudyRoutine;
