// Прослойка между игрой и площадкой (Telegram / обычный браузер, позже — Яндекс Игры).
// Игра обращается только к window.Platform, поэтому для переноса на другую площадку
// достаточно переписать этот файл.
(function () {
  const SAVE_KEY = 'plates_save';
  const CHUNK = 4000; // CloudStorage хранит до 4096 символов на ключ — режем сохранение на части
  const tg = window.Telegram && window.Telegram.WebApp;
  const inTelegram = !!(tg && tg.initData);
  const can = (v) => inTelegram && tg.isVersionAtLeast(v);

  const local = {
    get() { try { return localStorage.getItem(SAVE_KEY); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(SAVE_KEY, v); } catch (e) { /* приватный режим */ } },
  };

  const cs = () => tg.CloudStorage;
  const cloud = {
    ok: () => can('6.9') && !!tg.CloudStorage,
    get() {
      return new Promise((resolve) => {
        if (!cloud.ok()) return resolve(null);
        cs().getItem(SAVE_KEY + '_n', (err, n) => {
          n = parseInt(n, 10);
          if (err || !n) return resolve(null);
          const keys = Array.from({ length: n }, (_, i) => SAVE_KEY + '_' + i);
          cs().getItems(keys, (err2, values) => {
            if (err2 || !values) return resolve(null);
            resolve(keys.map((k) => values[k] || '').join(''));
          });
        });
      });
    },
    set(v) {
      if (!cloud.ok()) return;
      const n = Math.ceil(v.length / CHUNK);
      for (let i = 0; i < n; i++) cs().setItem(SAVE_KEY + '_' + i, v.slice(i * CHUNK, (i + 1) * CHUNK), () => {});
      cs().setItem(SAVE_KEY + '_n', String(n), () => {});
    },
  };

  const parse = (str) => { try { return str ? JSON.parse(str) : null; } catch (e) { return null; } };
  let backHandler = null;

  window.Platform = {
    name: inTelegram ? 'telegram' : 'web',

    init() {
      if (!inTelegram) return;
      tg.ready();
      tg.expand();
      if (can('7.7') && tg.disableVerticalSwipes) tg.disableVerticalSwipes();
      // Полный экран без шапки Telegram — только на телефонах (на компьютере он растянул бы окно на весь монитор).
      const mobile = ['android', 'ios'].includes(tg.platform);
      if (mobile && can('8.0') && tg.requestFullscreen && !tg.isFullscreen) {
        try { tg.requestFullscreen(); } catch (e) { /* старый клиент — останемся в обычном режиме */ }
      }
      if (mobile && can('8.0') && tg.lockOrientation) {
        try { tg.lockOrientation(); } catch (e) { /* не страшно */ }
      }
      if (can('6.1')) tg.BackButton.onClick(() => backHandler && backHandler());
    },

    // Цвет шапки Telegram под тему игры.
    setColors(bg) {
      if (can('6.1')) { tg.setHeaderColor(bg); tg.setBackgroundColor(bg); }
    },

    // Системная кнопка «Назад» в шапке Telegram. handler = null — спрятать.
    setBack(handler) {
      backHandler = handler;
      if (!can('6.1')) return;
      if (handler) tg.BackButton.show(); else tg.BackButton.hide();
    },
    hasNativeBack: () => can('6.1'),

    userName() {
      const u = inTelegram && tg.initDataUnsafe && tg.initDataUnsafe.user;
      return u ? u.first_name : null;
    },

    // Берём самое свежее из облака и локального сохранения.
    async load() {
      const a = parse(await cloud.get());
      const b = parse(local.get());
      if (a && b) return (a.t || 0) >= (b.t || 0) ? a : b;
      return a || b;
    },

    save(state) {
      const str = JSON.stringify(state);
      local.set(str);
      cloud.set(str);
    },

    // type: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'select'
    haptic(type) {
      if (!can('6.1') || !tg.HapticFeedback) {
        if (navigator.vibrate && type !== 'select') navigator.vibrate(type === 'heavy' ? 40 : 15);
        return;
      }
      const h = tg.HapticFeedback;
      if (type === 'success' || type === 'error') h.notificationOccurred(type);
      else if (type === 'select') h.selectionChanged();
      else h.impactOccurred(type);
    },

    confirm(text) {
      return new Promise((resolve) => {
        if (can('6.2')) tg.showConfirm(text, resolve);
        else resolve(window.confirm(text));
      });
    },

    // Реклама за награду. В Telegram рекламы пока нет — награда выдаётся сразу.
    // В версии для Яндекс Игр здесь будет ysdk.adv.showRewardedVideo.
    rewardedAd() { return Promise.resolve(true); },

    openLink(url) {
      if (inTelegram && url.startsWith('https://t.me/')) tg.openTelegramLink(url);
      else if (inTelegram) tg.openLink(url);
      else window.open(url, '_blank');
    },
  };
})();
