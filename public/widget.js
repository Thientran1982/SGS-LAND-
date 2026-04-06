(function () {
  'use strict';

  var CHAT_URL = window.SGSLAND_CHAT_URL || window.location.origin + '/livechat';

  var BUBBLE_SIZE = 60;
  var IFRAME_W = 380;
  var IFRAME_H = 600;
  var MARGIN = 20;

  var isOpen = false;

  function createBubble() {
    var btn = document.createElement('button');
    btn.id = 'sgsland-chat-bubble';
    btn.setAttribute('aria-label', 'Mở hộp chat hỗ trợ');
    btn.style.cssText = [
      'position:fixed',
      'bottom:' + MARGIN + 'px',
      'right:' + MARGIN + 'px',
      'width:' + BUBBLE_SIZE + 'px',
      'height:' + BUBBLE_SIZE + 'px',
      'border-radius:50%',
      'background:linear-gradient(135deg,#4f46e5,#7c3aed)',
      'color:#fff',
      'border:none',
      'cursor:pointer',
      'box-shadow:0 4px 24px rgba(79,70,229,.45)',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'z-index:2147483647',
      'transition:transform .2s,box-shadow .2s',
    ].join(';');

    btn.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

    btn.addEventListener('mouseenter', function () {
      btn.style.transform = 'scale(1.1)';
      btn.style.boxShadow = '0 6px 32px rgba(79,70,229,.6)';
    });
    btn.addEventListener('mouseleave', function () {
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = '0 4px 24px rgba(79,70,229,.45)';
    });
    btn.addEventListener('click', toggleChat);
    document.body.appendChild(btn);
    return btn;
  }

  function createFrame() {
    var wrapper = document.createElement('div');
    wrapper.id = 'sgsland-chat-frame-wrapper';
    wrapper.style.cssText = [
      'position:fixed',
      'bottom:' + (MARGIN + BUBBLE_SIZE + 12) + 'px',
      'right:' + MARGIN + 'px',
      'width:' + IFRAME_W + 'px',
      'height:' + IFRAME_H + 'px',
      'border-radius:20px',
      'overflow:hidden',
      'box-shadow:0 12px 48px rgba(0,0,0,.18)',
      'border:1px solid rgba(0,0,0,.08)',
      'background:#fff',
      'display:none',
      'z-index:2147483646',
      'transform:translateY(16px)',
      'opacity:0',
      'transition:opacity .25s,transform .25s',
    ].join(';');

    var iframe = document.createElement('iframe');
    iframe.src = CHAT_URL;
    iframe.style.cssText = 'width:100%;height:100%;border:none;display:block;';
    iframe.setAttribute('allow', 'microphone');
    iframe.setAttribute('title', 'SGS Land Live Chat');

    wrapper.appendChild(iframe);
    document.body.appendChild(wrapper);
    return wrapper;
  }

  function toggleChat() {
    isOpen = !isOpen;
    var wrapper = document.getElementById('sgsland-chat-frame-wrapper');
    var bubble = document.getElementById('sgsland-chat-bubble');
    if (!wrapper || !bubble) return;

    if (isOpen) {
      wrapper.style.display = 'block';
      requestAnimationFrame(function () {
        wrapper.style.opacity = '1';
        wrapper.style.transform = 'translateY(0)';
      });
      bubble.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    } else {
      wrapper.style.opacity = '0';
      wrapper.style.transform = 'translateY(16px)';
      setTimeout(function () { wrapper.style.display = 'none'; }, 260);
      bubble.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    }
  }

  function init() {
    if (document.getElementById('sgsland-chat-bubble')) return;
    createBubble();
    createFrame();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
