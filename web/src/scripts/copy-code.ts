// 為所有程式碼區塊新增複製按鈕
document.querySelectorAll('pre').forEach((pre) => {
  const wrapper = document.createElement('div');
  wrapper.className = 'code-block-wrapper';
  pre.parentNode?.insertBefore(wrapper, pre);
  wrapper.appendChild(pre);

  const btn = document.createElement('button');
  btn.className = 'copy-button';
  btn.textContent = '複製';
  btn.addEventListener('click', async () => {
    const code = pre.querySelector('code')?.textContent || pre.textContent || '';
    try {
      await navigator.clipboard.writeText(code);
      btn.textContent = '已複製！';
      setTimeout(() => { btn.textContent = '複製'; }, 2000);
    } catch {
      btn.textContent = '複製失敗';
      setTimeout(() => { btn.textContent = '複製'; }, 2000);
    }
  });
  wrapper.appendChild(btn);
});
