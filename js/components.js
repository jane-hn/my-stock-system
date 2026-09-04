/* ============================================================
   通用 UI 组件：弹窗、确认框、轻提示
   ============================================================ */
(function (global) {
  'use strict';

  var stack = [];

  function toast(msg, type) {
    var root = document.getElementById('toastRoot');
    if (!root) return;
    var div = document.createElement('div');
    div.className = 'toast ' + (type || 'info');
    div.textContent = msg;
    root.appendChild(div);
    setTimeout(function () {
      div.classList.add('out');
      setTimeout(function () { div.remove(); }, 350);
    }, 2600);
  }

  function openModal(opts) {
    var root = document.getElementById('modalRoot');
    var wrap = document.createElement('div');
    wrap.className = 'modal-mask';
    wrap.innerHTML =
      '<div class="modal ' + (opts.wide ? 'wide' : '') + '" role="dialog" aria-modal="true">' +
        '<div class="modal-head">' +
          '<h3>' + (opts.title || '') + '</h3>' +
          '<button class="icon-btn" type="button" data-close="1" aria-label="关闭">×</button>' +
        '</div>' +
        '<div class="modal-body">' + (opts.body || '') + '</div>' +
      '</div>';
    wrap.addEventListener('click', function (e) {
      if (e.target === wrap || (e.target.getAttribute && e.target.getAttribute('data-close'))) {
        closeTop();
      }
    });
    root.appendChild(wrap);
    stack.push(wrap);
    document.body.classList.add('modal-open');
    return wrap;
  }

  function closeTop() {
    var w = stack.pop();
    if (w) w.remove();
    if (!stack.length) document.body.classList.remove('modal-open');
  }

  function closeAll() {
    stack.forEach(function (w) { w.remove(); });
    stack = [];
    document.body.classList.remove('modal-open');
  }

  function confirmDialog(title, msg, danger) {
    return new Promise(function (resolve) {
      var w = openModal({
        title: title,
        body:
          '<p class="confirm-msg">' + msg + '</p>' +
          '<div class="form-actions">' +
            '<button class="btn ghost" id="cfNo" type="button">取消</button>' +
            '<button class="btn ' + (danger ? 'danger' : 'primary') + '" id="cfYes" type="button">确定</button>' +
          '</div>'
      });
      w.querySelector('#cfNo').onclick = function () { closeTop(); resolve(false); };
      w.querySelector('#cfYes').onclick = function () { closeTop(); resolve(true); };
    });
  }

  global.UI = { toast: toast, openModal: openModal, closeTop: closeTop, closeAll: closeAll, confirmDialog: confirmDialog };
})(window);
