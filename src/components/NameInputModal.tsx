import { useState, useEffect } from 'react';
import { updateUserName } from '../services/auth';
import { debugError } from '../utils/debug';
import './NameInputModal.css';

interface NameInputModalProps {
  isOpen: boolean;
  currentName: string;
  onClose: () => void;
  onNameSet: () => void;
}

export function NameInputModal({ isOpen, currentName, onClose, onNameSet }: NameInputModalProps) {
  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(currentName);
      setError('');
    }
  }, [isOpen, currentName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('이름을 입력해주세요.');
      return;
    }

    if (name.trim().length < 2) {
      setError('이름은 2자 이상 입력해주세요.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await updateUserName(name.trim());
      onNameSet();
      onClose();
    } catch (err: any) {
      debugError('NAME_INPUT', '이름 업데이트 실패', err);
      setError('이름 설정에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>이름 설정</h2>
        <p className="modal-description">사용할 이름을 입력해주세요</p>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름을 입력하세요"
              className="name-input"
              disabled={loading}
              autoFocus
              maxLength={20}
            />
            {error && <div className="error-message">{error}</div>}
          </div>

          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-outline"
              disabled={loading}
            >
              취소
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !name.trim()}
            >
              {loading ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

