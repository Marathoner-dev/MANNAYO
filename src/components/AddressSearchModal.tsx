import { useEffect, useRef } from 'react';
import { debugError } from '../utils/debug';
import './AddressSearchModal.css';

interface AddressSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAddress: (address: string) => void;
}

export function AddressSearchModal({
  isOpen,
  onClose,
  onSelectAddress,
}: AddressSearchModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const daum = (window as any).daum;
    if (!daum || !daum.Postcode) {
      debugError('ADDRESS_SEARCH', 'Daum 우편번호 서비스를 불러올 수 없습니다.', null);
      return;
    }

    // 컨테이너가 비어있지 않으면 초기화하지 않음
    if (containerRef.current && containerRef.current.children.length > 0) {
      return;
    }

    new daum.Postcode({
      oncomplete: (data: any) => {
        // 동/읍/면 그룹화를 위해 항상 지번 주소 사용
        // 지번 주소가 없으면 도로명 주소 사용 (fallback)
        let address = data.jibunAddress || data.roadAddress;

        // 참고항목이 있는 경우 추가
        if (data.buildingName !== '') {
          address += ` (${data.buildingName})`;
        }

        // 주소 선택 콜백 호출
        onSelectAddress(address);
        
        // 주소 선택 후 모달 닫기
        onClose();
      },
      width: '100%',
      height: '100%',
      maxSuggestItems: 5,
    }).embed(containerRef.current);

    // 정리 함수
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [isOpen, onClose, onSelectAddress]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content address-search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="address-search-header">
          <h2>주소 검색</h2>
          <button
            type="button"
            onClick={onClose}
            className="btn-close"
            aria-label="닫기"
          >
            ×
          </button>
        </div>
        <div className="address-search-container" ref={containerRef}></div>
      </div>
    </div>
  );
}
