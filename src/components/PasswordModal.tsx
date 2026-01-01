import { useState } from 'react';
import './PasswordModal.css';

interface PasswordModalProps {
  isOpen: boolean;
  calendarTitle: string;
  onClose: () => void;
  onPasswordCorrect: (password: string) => void;
  error?: string;
}

export function PasswordModal({
  isOpen,
  calendarTitle,
  onClose,
  onPasswordCorrect,
  error: externalError,
}: PasswordModalProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!password.trim()) {
      setError('비밀번호를 입력해주세요.');
      return;
    }

    // 비밀번호를 부모 컴포넌트로 전달하여 검증
    onPasswordCorrect(password);
  };

  const handleClose = () => {
    setPassword('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  const displayError = externalError || error;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content password-modal" onClick={(e) => e.stopPropagation()}>
        <h2>비밀번호 입력</h2>
        <p className="modal-description">
          <strong>{calendarTitle}</strong> 달력을 보려면 비밀번호가 필요합니다.
        </p>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="password">비밀번호</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder="비밀번호를 입력하세요"
              className="password-input"
              autoFocus
            />
            {displayError && <div className="error-message">{displayError}</div>}
          </div>

          <div className="modal-actions">
            <button
              type="button"
              onClick={handleClose}
              className="btn btn-outline"
            >
              취소
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!password.trim()}
            >
              확인
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

