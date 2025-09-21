import { useState } from 'react';

const ConsentModal = ({ onConsent, onDeny }) => {
  const [agreed, setAgreed] = useState(false);

  return (
    <div style={{ position: 'fixed', top: '20%', left: '20%', right: '20%', background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 0 10px rgba(0,0,0,0.5)' }}>
      <h2>Camera Access Consent</h2>
      <p>We need webcam access to monitor presence and engagement. No raw video is stored. Metrics are anonymized.</p>
      <label>
        <input type="checkbox" checked={agreed} onChange={() => setAgreed(!agreed)} />
        I consent to webcam use for this session.
      </label>
      <div>
        <button disabled={!agreed} onClick={onConsent}>Agree </button>
        <button onClick={onDeny}> Deny </button>
      </div>
    </div>
  );
};

export default ConsentModal;