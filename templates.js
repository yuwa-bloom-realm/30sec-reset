/* =====================================================================
   灯りの部屋『30秒リセット』演出テンプレート集
   ---------------------------------------------------------------------
   ここは「演出の型」を定義する場所です。文章そのものは書きません。
   日付データ(content-data.js)から template: "名前" で呼び出します。

   【全体構造:2レイヤー】
     ┌─────────────────────────────┐
     │ レイヤーA:天気(背景＋雨雪雷)              │ ← reset30.html が自動制御
     │   鹿児島の実際の天気で背景を選び、雨/雪/雷を重ねる  │   (データにも演出にも書かない)
     ├─────────────────────────────┤
     │ レイヤーB:30秒体験(このファイルの演出テンプレ)     │ ← template で選ぶ
     │   文章の出し方・間・締め方                   │
     └─────────────────────────────┘
     天気は「演出テンプレ」ではありません。どのテンプレを選んでも、
     その上に天気レイヤーが独立して重なります。だから template には
     "雨""晴れ"のような天気は書かず、文章の見せ方だけを選びます。

   【テンプレの仕組み】
   各テンプレは run(stage, data, opts) を持つオブジェクトです。
     stage … 描画に使う道具一式
        stage.greeting  … 上の小さな一言の要素
        stage.message   … 本文の要素
        stage.closing   … 締めの要素
        stage.duration  … 全体の長さ(ミリ秒。通常30000)
        stage.onComplete… 演出が終わったら呼ぶ(「もう一度」を出す)
     data … その日その時間帯のデータ { greeting, lines, closing, options }
     opts … data.options(テンプレごとの微調整。秒数や間隔など)
   戻り値に { stop } を返すと、再描画時に古い演出を止められます。

   【新しいテンプレの足し方】
   window.TEMPLATES["myNewName"] = { label:"説明", run(stage,data,opts){ ... } };
   と書き足すだけ。content-data.js から template:"myNewName" で使えます。

   ※ 下の helper(共通部品)を使うと、締めの表示やクリーンアップが楽です。
   ===================================================================== */

(function () {
  "use strict";

  // ---- 共通部品 ------------------------------------------------------
  const H = {
    // 締めのテキストを取り出す(無ければ null)
    closingText: function (data) {
      if (!data.closing) return null;
      return Array.isArray(data.closing) ? data.closing.join("\n") : String(data.closing);
    },

    // greeting を表示(共通)
    showGreeting: function (stage, data) {
      const g = stage.greeting;
      g.textContent = data.greeting || "";
      g.className = "greeting";
      void g.offsetWidth;
      if (data.greeting) g.classList.add("anim-greeting");
    },

    // 本文をクリアして行要素を作る(表示はまだしない)
    buildLines: function (stage, data) {
      const m = stage.message;
      m.className = "message";
      m.innerHTML = "";
      const lines = data.lines || [data.text || ""];
      const spans = lines.map(function (text) {
        const s = document.createElement("span");
        s.className = "line";
        s.textContent = text;
        s.style.opacity = "0";
        m.appendChild(s);
        return s;
      });
      return { m: m, spans: spans };
    },

    // 締めを出す(本文を引かせて締めを浮かべる)。timers に登録して片付け可能に
    scheduleClosing: function (stage, data, timers, opts) {
      const text = H.closingText(data);
      if (!text) return;
      const showAt = (opts.closingAt != null)
        ? opts.closingAt
        : stage.duration - (opts.closingHold || 6000);
      const style = opts.closingStyle || "zoom"; // zoom / fade
      timers.push(setTimeout(function () {
        stage.message.classList.add("retire");
        const c = stage.closing;
        c.textContent = text;
        c.className = "closing tpl-closing-" + style;
        void c.offsetWidth;
        c.classList.add("show");
      }, showAt));
    },

    // 演出終了時に「もう一度」を出す予約
    scheduleComplete: function (stage, timers) {
      timers.push(setTimeout(function () {
        if (stage.onComplete) stage.onComplete();
      }, stage.duration));
    },

    // リセット時に全タイマーを止める stop を作る
    makeStop: function (timers, extra) {
      return {
        stop: function () {
          timers.forEach(clearTimeout);
          timers.length = 0;
          if (extra) extra();
        },
      };
    },

    // 共通の下ごしらえ(greeting + 締め予約 + 完了予約)
    base: function (stage, data, opts) {
      const timers = [];
      H.showGreeting(stage, data);
      H.scheduleClosing(stage, data, timers, opts);
      H.scheduleComplete(stage, timers);
      return timers;
    },
  };

  // ---- テンプレート本体 ----------------------------------------------
  const TEMPLATES = {

    /* 1. fadeLines … 1行ずつ下からふわっと(基本・既定テンプレ)
       opts: lineInterval(行間ms), firstDelay(最初の遅れms) */
    fadeLines: {
      label: "1行ずつ下から浮かぶ(基本)",
      run: function (stage, data, opts) {
        const timers = H.base(stage, data, opts);
        const { spans } = H.buildLines(stage, data);
        const first = opts.firstDelay != null ? opts.firstDelay : 1000;
        const gap = opts.lineInterval != null ? opts.lineInterval : 1100;
        spans.forEach(function (s, i) {
          s.style.animationDelay = (first + i * gap) + "ms";
          void s.offsetWidth;
          s.classList.add("anim-line");
        });
        return H.makeStop(timers);
      },
    },

    /* 2. fadeAll … 全部いっぺんに静かにフェードイン
       opts: delay(出るまでの遅れ) */
    fadeAll: {
      label: "全文まとめて静かに現れる",
      run: function (stage, data, opts) {
        const timers = H.base(stage, data, opts);
        const { spans } = H.buildLines(stage, data);
        const delay = opts.delay != null ? opts.delay : 1200;
        spans.forEach(function (s) {
          s.style.animationDelay = delay + "ms";
          s.classList.add("tpl-fade");
        });
        return H.makeStop(timers);
      },
    },

    /* 3. zoomLines … 1行ずつ、ふわっと拡大しながら
       opts: lineInterval, firstDelay */
    zoomLines: {
      label: "1行ずつズームしながら現れる",
      run: function (stage, data, opts) {
        const timers = H.base(stage, data, opts);
        const { spans } = H.buildLines(stage, data);
        const first = opts.firstDelay != null ? opts.firstDelay : 1000;
        const gap = opts.lineInterval != null ? opts.lineInterval : 1400;
        spans.forEach(function (s, i) {
          s.style.animationDelay = (first + i * gap) + "ms";
          s.classList.add("tpl-zoom");
        });
        return H.makeStop(timers);
      },
    },

    /* 4. slideLines … 1行ずつ左からすっと入る
       opts: lineInterval, firstDelay */
    slideLines: {
      label: "1行ずつ左から流れ込む",
      run: function (stage, data, opts) {
        const timers = H.base(stage, data, opts);
        const { spans } = H.buildLines(stage, data);
        const first = opts.firstDelay != null ? opts.firstDelay : 900;
        const gap = opts.lineInterval != null ? opts.lineInterval : 1200;
        spans.forEach(function (s, i) {
          s.style.animationDelay = (first + i * gap) + "ms";
          s.classList.add("tpl-slide");
        });
        return H.makeStop(timers);
      },
    },

    /* 5. riseBlur … ぼやけ→くっきり、下から。夢から覚めるような
       opts: lineInterval, firstDelay */
    riseBlur: {
      label: "ぼやけて→くっきり浮かぶ",
      run: function (stage, data, opts) {
        const timers = H.base(stage, data, opts);
        const { spans } = H.buildLines(stage, data);
        const first = opts.firstDelay != null ? opts.firstDelay : 1000;
        const gap = opts.lineInterval != null ? opts.lineInterval : 1500;
        spans.forEach(function (s, i) {
          s.style.animationDelay = (first + i * gap) + "ms";
          s.classList.add("tpl-rise");
        });
        return H.makeStop(timers);
      },
    },

    /* 6. breathe … 全文が現れたあと、ゆっくり呼吸するように明滅
       opts: delay */
    breathe: {
      label: "現れた文章がゆっくり呼吸する",
      run: function (stage, data, opts) {
        const timers = H.base(stage, data, opts);
        const built = H.buildLines(stage, data);
        const delay = opts.delay != null ? opts.delay : 1200;
        built.spans.forEach(function (s) {
          s.style.animationDelay = delay + "ms";
          s.classList.add("tpl-fade");
        });
        built.m.classList.add("tpl-breathe");
        return H.makeStop(timers, function () {
          built.m.classList.remove("tpl-breathe");
        });
      },
    },

    /* 7. oneByOne … 1行が出て→消えて→次の行、と入れ替わる(標語カード風)
       opts: hold(1行の表示時間), fade(切替のフェード時間) */
    oneByOne: {
      label: "1行ずつ入れ替わりで見せる",
      run: function (stage, data, opts) {
        const timers = H.base(stage, data, opts);
        const m = stage.message;
        m.className = "message";
        m.innerHTML = "";
        const lines = data.lines || [data.text || ""];
        const hold = opts.hold != null ? opts.hold : 3000;
        const fade = opts.fade != null ? opts.fade : 800;

        const span = document.createElement("span");
        span.className = "line";
        span.style.opacity = "0";
        span.style.transition = "opacity " + fade + "ms ease";
        m.appendChild(span);

        let i = 0;
        function next() {
          if (i >= lines.length) return;
          span.textContent = lines[i];
          span.style.opacity = "1";
          timers.push(setTimeout(function () {
            span.style.opacity = "0";
            i++;
            timers.push(setTimeout(next, fade));
          }, hold));
        }
        timers.push(setTimeout(next, 800));
        return H.makeStop(timers);
      },
    },

    /* 8. typewriter … 1文字ずつ打ち込むように(1行目のみ or 全行連結)
       opts: speed(1文字ms), joiner(行の区切り。既定は改行) */
    typewriter: {
      label: "1文字ずつ打ち込まれる",
      run: function (stage, data, opts) {
        const timers = H.base(stage, data, opts);
        const m = stage.message;
        m.className = "message";
        m.innerHTML = "";
        const lines = data.lines || [data.text || ""];
        const joiner = opts.joiner != null ? opts.joiner : "\n";
        const full = lines.join(joiner);
        const speed = opts.speed != null ? opts.speed : 120;

        const span = document.createElement("span");
        span.className = "line";
        span.style.opacity = "1";
        span.style.whiteSpace = "pre-line";
        m.appendChild(span);

        let idx = 0;
        function type() {
          if (idx > full.length) return;
          span.textContent = full.slice(0, idx);
          idx++;
          timers.push(setTimeout(type, speed));
        }
        timers.push(setTimeout(type, 1000));
        return H.makeStop(timers);
      },
    },

    /* 9. centerHold … 短い一言を中央に大きく、ずっと置く(瞑想向き)
       opts: delay, big(true で特大) */
    centerHold: {
      label: "短い一言を中央に大きく置く",
      run: function (stage, data, opts) {
        const timers = H.base(stage, data, opts);
        const built = H.buildLines(stage, data);
        const delay = opts.delay != null ? opts.delay : 1400;
        built.m.style.fontSize = opts.big ? "2.4rem" : "";
        built.spans.forEach(function (s, i) {
          s.style.animationDelay = (delay + i * 400) + "ms";
          s.classList.add("tpl-fade");
        });
        return H.makeStop(timers, function () {
          built.m.style.fontSize = "";
        });
      },
    },

    /* 10. quietText … ほぼ演出なし。静かに出して静かに終わる(締めや無言の日向き)
        opts: delay */
    quietText: {
      label: "最小限。静かに出して静かに終わる",
      run: function (stage, data, opts) {
        const timers = H.base(stage, data, opts);
        const built = H.buildLines(stage, data);
        const delay = opts.delay != null ? opts.delay : 1500;
        built.spans.forEach(function (s, i) {
          s.style.animationDelay = (delay + i * 600) + "ms";
          s.classList.add("tpl-fade");
        });
        return H.makeStop(timers);
      },
    },

    /* 11. stillness … 静寂。1行出す→消す→無音の"間"→次の行。
        文字が消えている時間を意図的に作る(瞑想・夜向き)
        opts: hold(表示時間), silence(無音の間), fade(フェード) */
    stillness: {
      label: "静寂。文字を消して間をつくる",
      run: function (stage, data, opts) {
        const timers = H.base(stage, data, opts);
        const m = stage.message;
        m.className = "message";
        m.innerHTML = "";
        const lines = data.lines || [data.text || ""];
        const hold = opts.hold != null ? opts.hold : 3400;
        const silence = opts.silence != null ? opts.silence : 2200;
        const fade = opts.fade != null ? opts.fade : 1400;

        const span = document.createElement("span");
        span.className = "line";
        span.style.opacity = "0";
        span.style.transition = "opacity " + fade + "ms ease";
        m.appendChild(span);

        let i = 0;
        function cycle() {
          if (i >= lines.length) return;
          span.textContent = lines[i];
          span.style.opacity = "1";            // 現れる
          timers.push(setTimeout(function () {
            span.style.opacity = "0";          // 消える
            i++;
            timers.push(setTimeout(cycle, fade + silence)); // 無音の間
          }, hold));
        }
        timers.push(setTimeout(cycle, 1200));
        return H.makeStop(timers);
      },
    },

    /* 12. tapReveal … タップで進む。触れた場所に光の粒、次の行が現れる。
        opts: hint(最初のヒント文) */
    tapReveal: {
      label: "タップで1行ずつ・光の粒が出る",
      run: function (stage, data, opts) {
        const timers = H.base(stage, data, opts);
        const built = H.buildLines(stage, data);
        const spans = built.spans;

        // タップのヒント
        const hint = document.createElement("div");
        hint.className = "tap-hint";
        hint.textContent = opts.hint || "画面をそっとタップ";
        document.body.appendChild(hint);
        timers.push(setTimeout(function () { hint.classList.add("show"); }, 900));

        let shown = 0;
        function reveal() {
          if (shown < spans.length) {
            const s = spans[shown];
            s.style.animationDelay = "0ms";
            s.classList.add("tpl-fade");
            shown++;
            if (shown === spans.length) hint.classList.remove("show");
          }
        }
        // 最初の1行は自動で出す
        timers.push(setTimeout(reveal, 1200));

        // click と touchstart の二重発火を防ぐ(触った直後の click を無視)
        let lastTouch = 0;
        function spark(x, y) {
          const s = document.createElement("div");
          s.className = "tap-spark";
          s.style.left = x + "px";
          s.style.top = y + "px";
          document.body.appendChild(s);
          setTimeout(function () { s.remove(); }, 900);
        }
        function onTouch(e) {
          lastTouch = Date.now();
          const t = e.touches[0];
          spark(t.clientX, t.clientY);
          reveal();
        }
        function onClick(e) {
          if (Date.now() - lastTouch < 600) return; // タッチ由来のclickは無視
          spark(e.clientX, e.clientY);
          reveal();
        }
        document.addEventListener("touchstart", onTouch, { passive: true });
        document.addEventListener("click", onClick);

        return H.makeStop(timers, function () {
          document.removeEventListener("touchstart", onTouch);
          document.removeEventListener("click", onClick);
          hint.remove();
        });
      },
    },

  };

  window.TEMPLATES = TEMPLATES;
})();