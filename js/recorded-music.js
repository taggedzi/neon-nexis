/* Optional streamed soundtrack; the procedural engine owns the fallback. */
(function() {
  'use strict';
  const N = window.NEON;

  N.RecordedMusic = {
    create(context, destination, onActive) {
      const library = Array.isArray(N.MUSIC_TRACKS) ? N.MUSIC_TRACKS : [];
      const tracks = [...new Set(library.filter(track =>
        typeof track === 'string' && /^assets\/music\/[a-f0-9]{64}\.mp3$/.test(track)))];
      if (!tracks.length) {
        return null;
      }
      const media = new Audio();
      media.preload = 'none';
      const source = context.createMediaElementSource(media);
      const gain = context.createGain();
      source.connect(gain);
      gain.connect(destination);
      const failed = new Set();
      let bag = [];
      let current = null;
      let active = false;
      let pending = false;
      let generation = 0;
      let blocked = false;
      let state = { unlocked: false, suspended: false, silent: false, scene: 'menu' };

      function setActive(value) {
        if (active !== value) {
          active = value;
          onActive(value);
        }
      }
      function shouldPlay() {
        return state.unlocked && !state.suspended && !state.silent && !document.hidden
          && context.state === 'running' && !blocked;
      }
      function chooseTrack() {
        if (!bag.length) {
          bag = tracks.filter(track => !failed.has(track));
          for (let index = bag.length - 1; index > 0; index--) {
            const other = Math.floor(Math.random() * (index + 1));
            [bag[index], bag[other]] = [bag[other], bag[index]];
          }
          if (bag.length > 1 && bag[bag.length - 1] === current) {
            [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
          }
        }
        return bag.pop();
      }
      function loadNext() {
        generation++;
        pending = false;
        setActive(false);
        const next = chooseTrack();
        if (!next) {
          current = null;
          media.removeAttribute('src');
          media.load();
          return;
        }
        current = next;
        media.src = next;
        media.load();
        sync();
      }
      function failCurrent() {
        if (!current) {
          return;
        }
        failed.add(current);
        bag = bag.filter(track => !failed.has(track));
        media.pause();
        loadNext();
      }
      function sync() {
        const level = state.scene === 'paused' || state.scene === 'dead' ? .22
          : state.scene === 'menu' ? .6 : .9;
        gain.gain.setTargetAtTime(level, context.currentTime, .2);
        if (!shouldPlay()) {
          generation++;
          pending = false;
          media.pause();
          setActive(false);
          return;
        }
        if (!current || pending || !media.paused) {
          return;
        }
        pending = true;
        const request = ++generation;
        try {
          Promise.resolve(media.play()).then(() => {
            if (request !== generation) {
              return;
            }
            pending = false;
            setActive(shouldPlay() && !media.paused);
          }).catch(error => {
            if (request !== generation) {
              return;
            }
            pending = false;
            setActive(false);
            if (error.name === 'NotAllowedError' || error.name === 'AbortError') {
              blocked = true;
            } else {
              failCurrent();
            }
          });
        } catch (error) {
          pending = false;
          failCurrent();
        }
      }
      media.addEventListener('ended', loadNext);
      media.addEventListener('error', failCurrent);
      media.addEventListener('playing', () => setActive(shouldPlay()));
      media.addEventListener('waiting', () => setActive(false));
      media.addEventListener('stalled', () => setActive(false));
      document.addEventListener('visibilitychange', sync);
      context.addEventListener('statechange', sync);
      loadNext();
      return {
        update(values, retry = false) {
          state = { ...state, ...values };
          if (retry) {
            blocked = false;
          }
          sync();
        },
        isActive: () => active,
        status: () => ({ mode: active ? 'recorded' : 'procedural', track: current,
          available: tracks.length - failed.size })
      };
    }
  };
})();
