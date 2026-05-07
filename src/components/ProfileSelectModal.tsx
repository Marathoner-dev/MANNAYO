import { useState, useEffect } from 'react';
import {
  addProfile,
  subscribeProfiles,
  pickRandomColor,
  isProfileAuthenticated,
  setProfileAuthenticated,
  deleteProfile,
  clearProfileAuthenticated,
} from '../services/profile';
import type { Profile } from '../types';
import { debugError, debugLog } from '../utils/debug';
import './ProfileSelectModal.css';

interface ProfileSelectModalProps {
  isOpen: boolean;
  calendarId: string;
  calendarTitle: string;
  onSelect: (profile: Profile) => void;
  onClose?: () => void;
  // 달력 주인 여부 — true이면 본인(첫) 프로필을 제외한 다른 프로필을 삭제할 수 있음
  isOwner?: boolean;
  // 삭제된 프로필 ID 알림 (현재 선택 프로필이 삭제된 경우 호출자가 정리)
  onProfileDeleted?: (profileId: string) => void;
}

type View = 'list' | 'add' | 'password';

export function ProfileSelectModal({
  isOpen,
  calendarId,
  calendarTitle,
  onSelect,
  onClose,
  isOwner = false,
  onProfileDeleted,
}: ProfileSelectModalProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [view, setView] = useState<View>('list');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pendingProfile, setPendingProfile] = useState<Profile | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 프로필 목록 실시간 구독
  useEffect(() => {
    if (!isOpen || !calendarId) return;

    const unsubscribe = subscribeProfiles(calendarId, (data) => {
      setProfiles(data);
    });

    return () => unsubscribe();
  }, [isOpen, calendarId]);

  // 모달이 닫힐 때 입력 상태 초기화
  useEffect(() => {
    if (!isOpen) {
      setView('list');
      setNewName('');
      setNewPassword('');
      setPendingProfile(null);
      setPasswordInput('');
      setError('');
    }
  }, [isOpen]);

  const handleSelectExisting = (profile: Profile) => {
    debugLog('PROFILE_SELECT_MODAL', '기존 프로필 클릭', {
      profileId: profile.id,
      name: profile.name,
      hasPassword: !!profile.password,
    });

    // 비밀번호 보호된 프로필 → 인증 단계
    if (profile.password) {
      // 이미 한 번 인증한 프로필은 바로 통과
      if (isProfileAuthenticated(profile.id)) {
        debugLog('PROFILE_SELECT_MODAL', '인증 캐시 적중 - 바로 선택', {
          profileId: profile.id,
        });
        onSelect(profile);
        return;
      }
      setPendingProfile(profile);
      setPasswordInput('');
      setError('');
      setView('password');
      return;
    }

    onSelect(profile);
  };

  const handleVerifyPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingProfile) return;

    if (!passwordInput.trim()) {
      setError('비밀번호를 입력해주세요.');
      return;
    }

    if (passwordInput === pendingProfile.password) {
      debugLog('PROFILE_SELECT_MODAL', '프로필 비밀번호 확인 성공', {
        profileId: pendingProfile.id,
      });
      setProfileAuthenticated(pendingProfile.id);
      onSelect(pendingProfile);
    } else {
      debugLog('PROFILE_SELECT_MODAL', '프로필 비밀번호 불일치', {
        profileId: pendingProfile.id,
      });
      setError('비밀번호가 일치하지 않습니다.');
    }
  };

  const handleDelete = async (
    e: React.MouseEvent<HTMLButtonElement>,
    profile: Profile
  ) => {
    e.stopPropagation();

    if (!confirm(`"${profile.name}" 프로필을 삭제하시겠습니까?\n해당 프로필이 입력한 일정도 함께 삭제됩니다.`)) {
      return;
    }

    setDeletingId(profile.id);
    setError('');
    try {
      await deleteProfile(calendarId, profile.id);
      clearProfileAuthenticated(profile.id);
      debugLog('PROFILE_SELECT_MODAL', '프로필 삭제 완료', {
        profileId: profile.id,
        name: profile.name,
      });
      onProfileDeleted?.(profile.id);
    } catch (err: any) {
      debugError('PROFILE_SELECT_MODAL', '프로필 삭제 실패', err);
      setError(err.message || '프로필 삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddNew = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = newName.trim();
    if (!trimmed) {
      setError('이름을 입력해주세요.');
      return;
    }
    if (trimmed.length > 20) {
      setError('이름은 20자 이내로 입력해주세요.');
      return;
    }

    if (!newPassword.trim()) {
      setError('비밀번호를 입력해주세요.');
      return;
    }
    if (newPassword.length < 4) {
      setError('비밀번호는 4자 이상이어야 합니다.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const usedColors = profiles.map((p) => p.color);
      const color = pickRandomColor(usedColors);
      const profile = await addProfile(
        calendarId,
        trimmed,
        color,
        newPassword
      );
      debugLog('PROFILE_SELECT_MODAL', '새 프로필 생성', {
        profileId: profile.id,
        name: profile.name,
        color: profile.color,
        hasPassword: !!profile.password,
      });
      // 본인이 만든 프로필은 자동 인증 처리
      if (profile.password) {
        setProfileAuthenticated(profile.id);
      }
      onSelect(profile);
    } catch (err: any) {
      debugError('PROFILE_SELECT_MODAL', '프로필 생성 실패', err);
      setError(err.message || '프로필 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content profile-select-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="profile-modal-close"
            aria-label="닫기"
          >
            ✕
          </button>
        )}
        {view === 'password' && pendingProfile ? (
          <>
            <h2>비밀번호 입력</h2>
            <p className="modal-description">
              <strong>{pendingProfile.name}</strong> 프로필은 비밀번호로 보호되어 있습니다.
            </p>
            <form onSubmit={handleVerifyPassword} className="profile-add-form">
              <div className="form-group">
                <label htmlFor="profile-pwd-input">비밀번호</label>
                <input
                  id="profile-pwd-input"
                  type="password"
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setError('');
                  }}
                  placeholder="비밀번호를 입력하세요"
                  className="profile-name-input"
                  autoFocus
                />
                {error && <div className="error-message">{error}</div>}
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => {
                    setView('list');
                    setPendingProfile(null);
                    setPasswordInput('');
                    setError('');
                  }}
                  className="btn btn-outline"
                >
                  뒤로
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!passwordInput.trim()}
                >
                  확인
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <h2>프로필 선택</h2>
            <p className="modal-description">
              <strong>{calendarTitle}</strong> 달력에서 사용할 프로필을 선택하세요.
            </p>

            {profiles.length > 0 && view === 'list' && (() => {
              const sorted = [...profiles].sort(
                (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
              );
              const ownerProfileId = sorted[0]?.id;
              return (
                <div className="profile-list">
                  {sorted.map((profile) => {
                    const isOwnerProfile = profile.id === ownerProfileId;
                    const canDelete = isOwner && !isOwnerProfile;
                    const isDeleting = deletingId === profile.id;
                    return (
                      <div key={profile.id} className="profile-item-row">
                        <button
                          type="button"
                          className="profile-item"
                          onClick={() => handleSelectExisting(profile)}
                          disabled={loading || isDeleting}
                        >
                          <span
                            className="profile-avatar"
                            style={{ backgroundColor: profile.color }}
                          >
                            {profile.name.charAt(0)}
                          </span>
                          <span className="profile-name">{profile.name}</span>
                          {profile.password && (
                            <span className="profile-lock" title="비밀번호 보호됨">
                              🔒
                            </span>
                          )}
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            className="profile-delete-btn"
                            onClick={(e) => handleDelete(e, profile)}
                            disabled={isDeleting || loading}
                            title="프로필 삭제"
                            aria-label={`${profile.name} 프로필 삭제`}
                          >
                            {isDeleting ? '...' : '×'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {profiles.length === 0 && view === 'list' && (
              <p className="profile-empty">
                아직 등록된 프로필이 없어요. 첫 프로필을 추가해보세요!
              </p>
            )}

            {view === 'add' ? (
              <form onSubmit={handleAddNew} className="profile-add-form">
                <div className="form-group">
                  <label htmlFor="profile-name">프로필 이름</label>
                  <input
                    id="profile-name"
                    type="text"
                    value={newName}
                    onChange={(e) => {
                      setNewName(e.target.value);
                      setError('');
                    }}
                    placeholder="이름을 입력하세요"
                    className="profile-name-input"
                    maxLength={20}
                    autoFocus
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="profile-pwd">
                    비밀번호 <span className="form-hint">(4자 이상)</span>
                  </label>
                  <input
                    id="profile-pwd"
                    type="password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setError('');
                    }}
                    placeholder="비밀번호를 입력하세요"
                    className="profile-name-input"
                    minLength={4}
                    required
                    disabled={loading}
                  />
                </div>

                {error && <div className="error-message">{error}</div>}

                <div className="modal-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setView('list');
                      setNewName('');
                      setNewPassword('');
                      setError('');
                    }}
                    className="btn btn-outline"
                    disabled={loading}
                  >
                    뒤로
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading || !newName.trim()}
                  >
                    {loading ? '추가 중...' : '추가하기'}
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setView('add')}
                className="btn btn-add-profile"
              >
                + 프로필 추가하기
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
