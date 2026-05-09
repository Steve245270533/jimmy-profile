const profile = {
    nameEn: "Jimmy",
    nameZh: "吉咪",
    birthday: "2022.04.18",
    hobbies: ["晨光窗台巡逻", "逗猫棒高速追击", "抱着毛毯午睡", "偷听包装袋响动"],
    traits: [
        "先观察，再慢悠悠靠近你。",
        "熟悉环境后会露出很有主见的小表情。",
        "喜欢被温柔夸奖，也擅长用眼神催你陪玩。"
    ],
    tagline: "Jimmy 把认真观察当成表达方式，视线总比脚步先一步抵达。"
};

const spriteConfig = {
    src: "./assets/sprite.webp",
    cols: 12,
    rows: 10,
    validFrames: 115,
    frameWidth: 834,
    frameHeight: 1112,
    defaultFrame: 0,
    smoothing: 0.24,
    pointerBlendSmoothing: 0.42,
    idleDelay: 1800,
    orientationTilt: 18,
    invertDirection: true
};

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const totalFrames = spriteConfig.validFrames;

const elements = {
    basicList: document.getElementById("profile-basic-list"),
    likesList: document.getElementById("likes-list"),
    traitsList: document.getElementById("traits-list"),
    tagline: document.getElementById("tagline-text"),
    sensorButton: document.getElementById("sensor-button"),
    sensorHint: document.getElementById("sensor-hint"),
    spriteWindow: document.getElementById("sprite-window"),
    spriteSheet: document.getElementById("sprite-sheet")
};

const state = {
    currentFrame: spriteConfig.defaultFrame,
    targetFrame: spriteConfig.defaultFrame,
    rafId: 0,
    idleTimer: 0,
    sensorActive: false,
    pointerActive: false,
    orientationHandler: null,
    lastTouchTime: 0
};

function populateProfile() {
    const basicItems = [
        ["英文名", profile.nameEn],
        ["中文名", profile.nameZh],
        ["生日", profile.birthday],
        ["关系", "家里最会回头确认你在不在的小朋友"]
    ];

    elements.basicList.innerHTML = basicItems
        .map(
            ([label, value]) => `
                <dt>${label}</dt>
                <dd>${value}</dd>
            `
        )
        .join("");

    elements.likesList.innerHTML = profile.hobbies
        .map((item) => `<li>${item}</li>`)
        .join("");

    elements.traitsList.innerHTML = profile.traits
        .map((item) => `<li>${item.trim()}</li>`)
        .join("");

    elements.tagline.textContent = profile.tagline.trim();
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function normalizeFrame(frame) {
    return ((frame % totalFrames) + totalFrames) % totalFrames;
}

function normalizeFrameIndex(frame) {
    return ((Math.round(frame) % totalFrames) + totalFrames) % totalFrames;
}

function frameToPosition(frame) {
    const normalized = normalizeFrameIndex(frame);
    const row = Math.floor(normalized / spriteConfig.cols);
    const col = normalized % spriteConfig.cols;

    return {
        x: -(col * spriteConfig.frameWidth),
        y: -(row * spriteConfig.frameHeight)
    };
}

function renderFrame(frame) {
    const normalized = normalizeFrame(frame);
    const position = frameToPosition(normalized);

    elements.spriteSheet.style.backgroundPosition = `${position.x}px ${position.y}px`;
    elements.spriteSheet.dataset.frame = String(normalizeFrameIndex(normalized));
    elements.spriteWindow.dataset.frame = normalized.toFixed(3);
}

function stopAnimationLoop() {
    if (!state.rafId) {
        return;
    }

    window.cancelAnimationFrame(state.rafId);
    state.rafId = 0;
}

function scheduleIdleReset() {
    clearTimeout(state.idleTimer);
    elements.spriteWindow.classList.remove("is-idle");

    state.idleTimer = window.setTimeout(() => {
        setTargetFrame(spriteConfig.defaultFrame, { resetIdle: false });
        elements.spriteWindow.classList.add("is-idle");
    }, spriteConfig.idleDelay);
}

function setTargetFrame(frame, options = {}) {
    const { immediate = false, resetIdle = true, smoothing = spriteConfig.smoothing } = options;
    state.targetFrame = normalizeFrame(frame);

    if (resetIdle) {
        scheduleIdleReset();
    }

    if (immediate || prefersReducedMotion) {
        const delta = state.targetFrame - state.currentFrame;
        const wrappedDelta = delta > totalFrames / 2
            ? delta - totalFrames
            : delta < -totalFrames / 2
                ? delta + totalFrames
                : delta;

        stopAnimationLoop();
        state.currentFrame = normalizeFrame(state.currentFrame + wrappedDelta * smoothing);
        renderFrame(state.currentFrame);
        return;
    }

    startAnimationLoop();
}

function startAnimationLoop() {
    if (prefersReducedMotion) {
        state.currentFrame = state.targetFrame;
        renderFrame(state.currentFrame);
        return;
    }

    if (state.rafId) {
        return;
    }

    const tick = () => {
        const delta = state.targetFrame - state.currentFrame;
        const wrappedDelta = delta > totalFrames / 2
            ? delta - totalFrames
            : delta < -totalFrames / 2
                ? delta + totalFrames
                : delta;

        if (Math.abs(wrappedDelta) < 0.02) {
            state.currentFrame = state.targetFrame;
            renderFrame(state.currentFrame);
            state.rafId = 0;
            return;
        }

        state.currentFrame += wrappedDelta * spriteConfig.smoothing;
        renderFrame(state.currentFrame);
        state.rafId = window.requestAnimationFrame(tick);
    };

    state.rafId = window.requestAnimationFrame(tick);
}

function directionToFrame(deltaX, deltaY) {
    const angle = Math.atan2(deltaY, deltaX);
    const correctedAngle = spriteConfig.invertDirection ? angle + Math.PI : angle;
    const normalizedAngle = correctedAngle < 0
        ? correctedAngle + Math.PI * 2
        : correctedAngle % (Math.PI * 2);
    const frame = (normalizedAngle / (Math.PI * 2)) * totalFrames;

    return normalizeFrame(frame);
}

function getPointerFrame(clientX, clientY) {
    const rect = elements.spriteWindow.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = clientX - centerX;
    const deltaY = clientY - centerY;

    if (Math.abs(deltaX) < 6 && Math.abs(deltaY) < 6) {
        return spriteConfig.defaultFrame;
    }

    return directionToFrame(deltaX, deltaY);
}

function handlePointerMove(event) {
    if (state.sensorActive) {
        return;
    }

    state.pointerActive = true;
    setTargetFrame(getPointerFrame(event.clientX, event.clientY), {
        immediate: true,
        smoothing: spriteConfig.pointerBlendSmoothing
    });
}

function handlePointerLeave() {
    state.pointerActive = false;
    clearTimeout(state.idleTimer);
    stopAnimationLoop();
    elements.spriteWindow.classList.add("is-idle");
    setTargetFrame(spriteConfig.defaultFrame, { immediate: true, resetIdle: false });
}

function handleTouchMove(event) {
    if (!event.touches || !event.touches[0]) {
        return;
    }

    state.lastTouchTime = Date.now();
    const touch = event.touches[0];
    setTargetFrame(getPointerFrame(touch.clientX, touch.clientY), {
        immediate: true,
        smoothing: spriteConfig.pointerBlendSmoothing
    });
}

function handleTouchEnd() {
    if (Date.now() - state.lastTouchTime < 140) {
        return;
    }

    handlePointerLeave();
}

function orientationToFrame(beta, gamma) {
    const x = clamp(gamma / spriteConfig.orientationTilt, -1, 1);
    const y = clamp(beta / spriteConfig.orientationTilt, -1, 1);

    if (Math.abs(x) < 0.08 && Math.abs(y) < 0.08) {
        return spriteConfig.defaultFrame;
    }

    return directionToFrame(x, y);
}

function setSensorMessage(message, disabled = false) {
    elements.sensorHint.textContent = message;
    elements.sensorButton.classList.toggle("is-disabled", disabled);
}

function fallbackToTouch(reason) {
    state.sensorActive = false;
    setSensorMessage(`${reason} 已切换为触摸互动模式，按住并拖动屏幕也能让 Jimmy 转头。`, true);
}

function bindOrientationListener() {
    if (state.orientationHandler) {
        return;
    }

    state.orientationHandler = (event) => {
        const beta = typeof event.beta === "number" ? event.beta : 0;
        const gamma = typeof event.gamma === "number" ? event.gamma : 0;
        setTargetFrame(orientationToFrame(beta, gamma));
    };

    window.addEventListener("deviceorientation", state.orientationHandler, true);
    state.sensorActive = true;
    setSensorMessage("感应模式已开启。轻轻转动设备，Jimmy 会跟着你的方向缓慢转头。");
}

async function activateSensorMode() {
    const hasDeviceOrientation = typeof window.DeviceOrientationEvent !== "undefined";

    if (!hasDeviceOrientation) {
        fallbackToTouch("当前设备不支持重力感应。");
        return;
    }

    try {
        if (typeof DeviceOrientationEvent.requestPermission === "function") {
            const permission = await DeviceOrientationEvent.requestPermission();

            if (permission !== "granted") {
                fallbackToTouch("你没有授予感应权限。");
                return;
            }
        }

        bindOrientationListener();
    } catch (error) {
        fallbackToTouch("感应模式暂时不可用。");
        console.error(error);
    }
}

function applySpriteSizing() {
    const width = getComputedStyle(elements.spriteWindow).width;
    const numericWidth = parseFloat(width);

    if (!Number.isFinite(numericWidth) || numericWidth <= 0) {
        return;
    }

    const scale = numericWidth / spriteConfig.frameWidth;
    elements.spriteSheet.style.transform = `scale(${scale})`;
}

function bindEvents() {
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave, { passive: true });
    window.addEventListener("resize", applySpriteSizing, { passive: true });

    elements.spriteWindow.addEventListener("touchstart", handleTouchMove, { passive: true });
    elements.spriteWindow.addEventListener("touchmove", handleTouchMove, { passive: true });
    elements.spriteWindow.addEventListener("touchend", handleTouchEnd, { passive: true });

    elements.sensorButton.addEventListener("click", activateSensorMode);
}

function initialize() {
    populateProfile();
    elements.spriteSheet.style.backgroundImage = `url("${spriteConfig.src}")`;
    renderFrame(spriteConfig.defaultFrame);
    elements.spriteWindow.classList.add("is-idle");
    applySpriteSizing();
    bindEvents();
}

initialize();
