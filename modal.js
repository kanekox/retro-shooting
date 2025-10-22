// グローバル変数としてIMEの状態を管理
let isIMEComposing = false;

// 名前入力のセットアップ
function setupNameInput() {
  const nameInput = document.getElementById('playerNameInput');
  if (!nameInput) return;

  // 既存のイベントリスナーを削除（重複を防ぐ）
  const newNameInput = nameInput.cloneNode(true);
  nameInput.parentNode.replaceChild(newNameInput, nameInput);

  // 新しいイベントリスナーを設定
  newNameInput.addEventListener('keydown', e => {
    // IME確定時のEnterは無視
    if (e.code === 'Enter' && isIMEComposing) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // IME確定後またはIME未使用時のEnterで保存
    if (e.code === 'Enter' && !isIMEComposing) {
      e.preventDefault();
      e.stopPropagation();
      const value = newNameInput.value.trim();
      if (value) {
        submitScore();
      }
    }
  });

  // フォーカスを設定
  newNameInput.focus();
}

function showNameInputDialog() {
  console.log('showNameInputDialog called, gameOver=', gameOver, 'gameOverState=', gameOverState);
  const modalContent = document.querySelector('#nameInputModal .modal-content');
  modalContent.innerHTML = `
    <h2>新記録達成！</h2>
    <p>ハイスコア: ${score} 点</p>
    <p>名前を入力してください：</p>
    <input type="text" id="playerNameInput" maxlength="10" placeholder="名前を入力">
    <div>
      <button onclick="submitScore()">保存</button>
      <button onclick="closeModal('nameInputModal')">キャンセル</button>
    </div>
  `;
  showModal('nameInputModal');
  setupNameInput();
}

// モーダル関連の関数
function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'block';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
    if (modalId === 'nameInputModal') {
      const input = document.getElementById('playerNameInput');
      if (input) input.value = '';
    }
  }
}

// モーダルのイベント設定
document.addEventListener('DOMContentLoaded', () => {
  // IME入力の状態管理
  document.addEventListener('compositionstart', () => {
    isIMEComposing = true;
  });

  document.addEventListener('compositionend', () => {
    isIMEComposing = false;
  });

  // 全てのモーダルに外側クリックで閉じる機能を追加
  document.querySelectorAll('.modal').forEach(modal => {
    // モーダル内のキー入力をゲームに伝播させない
    modal.addEventListener('keydown', e => {
      e.stopPropagation();
    }, true);

    // 外側クリックで閉じる
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        closeModal(modal.id);
      }
    });
  });
});