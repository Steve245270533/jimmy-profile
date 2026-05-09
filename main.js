const profile = {
    nameEn: "Jimmy",
    nameZh: "吉咪",
    birthday: "2024.04.18",
    hobbies: ["突然疯跑", "红外线高速追击", "趴在床上睡", "拍屁股"],
    traits: [
        "先观察，再慢悠悠靠近你。",
        "熟悉环境后会露出很有主见的小表情。",
        "喜欢被温柔夸奖，也擅长撒娇催你陪玩。"
    ],
    tagline: "Jimmy 把认真观察当成表达方式，视线总比脚步先一步抵达。"
};

const spriteConfig = {
    cols: 12,
    rows: 10,
    validFrames: 115,
    defaultFrame: 0,
    orientationTilt: 18,
    invertDirection: true,
    nearLockRatio: 0.12,
    angleDeadZone: 2.5,
    frameDeadZone: 1,
    loaderTimeoutMs: 5000
};

const totalFrames = spriteConfig.validFrames;
const fullTurn = Math.PI * 2;

const framePositions = Array.from({ length: totalFrames }, (_, frame) => {
    const row = Math.floor(frame / spriteConfig.cols);
    const col = frame % spriteConfig.cols;

    return {
        x: spriteConfig.cols === 1 ? 0 : (col / (spriteConfig.cols - 1)) * 100,
        y: spriteConfig.rows === 1 ? 0 : (row / (spriteConfig.rows - 1)) * 100
    };
});

const angleFrameKeys = [
    [0, 0],
    [45, Math.round(totalFrames * 0.125)],
    [90, Math.round(totalFrames * 0.25)],
    [135, Math.round(totalFrames * 0.375)],
    [180, Math.round(totalFrames * 0.5)],
    [225, Math.round(totalFrames * 0.625)],
    [270, Math.round(totalFrames * 0.75)],
    [315, Math.round(totalFrames * 0.875)],
    [360, totalFrames]
];

const leftMiddleConfig = {
    angleWindow: 28,
    frameStart: (spriteConfig.rows - 2) * spriteConfig.cols,
    frameEnd: (spriteConfig.rows - 1) * spriteConfig.cols + 2
};

const elements = {
    basicList: document.getElementById("profile-basic-list"),
    likesList: document.getElementById("likes-list"),
    traitsList: document.getElementById("traits-list"),
    tagline: document.getElementById("tagline-text"),
    sensorButton: document.getElementById("sensor-button"),
    sensorHint: document.getElementById("sensor-hint"),
    spriteWindow: document.getElementById("sprite-window"),
    spriteSheet: document.getElementById("sprite-sheet"),
    spriteLoader: document.getElementById("sprite-loader")
};

const state = {
    pointerX: -1000,
    pointerY: -1000,
    orientationX: 0,
    orientationY: 0,
    renderedFrame: -1,
    renderScheduled: false,
    sensorActive: false,
    pointerActive: false,
    orientationHandler: null,
    spriteRect: null,
    lastAngle: null,
    spriteReady: false
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

function normalizeFrameIndex(frame) {
    return ((Math.round(frame) % totalFrames) + totalFrames) % totalFrames;
}

function setFrame(frame) {
    const frameIndex = normalizeFrameIndex(frame);

    if (frameIndex === state.renderedFrame) {
        return;
    }

    state.renderedFrame = frameIndex;

    const position = framePositions[frameIndex];
    elements.spriteSheet.style.backgroundPosition = `${position.x}% ${position.y}%`;
}

function updateSpriteRect() {
    state.spriteRect = elements.spriteWindow.getBoundingClientRect();
}

function scheduleRender() {
    if (state.renderScheduled) {
        return;
    }

    state.renderScheduled = true;
    window.requestAnimationFrame(render);
}

function getCircularDistance(a, b, modulo) {
    const distance = Math.abs(a - b) % modulo;
    return Math.min(distance, modulo - distance);
}

function getSignedAngleDistance(from, to) {
    return ((to - from + 540) % 360) - 180;
}

function leftMiddleAngleToFrame(degrees) {
    const signedAngle = degrees > 180 ? degrees - 360 : degrees;

    if (Math.abs(signedAngle) > leftMiddleConfig.angleWindow) {
        return null;
    }

    const progress = (signedAngle + leftMiddleConfig.angleWindow) / (leftMiddleConfig.angleWindow * 2);
    return normalizeFrameIndex(leftMiddleConfig.frameStart + (leftMiddleConfig.frameEnd - leftMiddleConfig.frameStart) * progress);
}

function angleToFrame(degrees) {
    const normalized = ((degrees % 360) + 360) % 360;
    const leftMiddleFrame = leftMiddleAngleToFrame(normalized);

    if (leftMiddleFrame !== null) {
        return leftMiddleFrame;
    }

    for (let i = 0; i < angleFrameKeys.length - 1; i++) {
        const [a0, f0] = angleFrameKeys[i];
        const [a1, f1] = angleFrameKeys[i + 1];

        if (normalized >= a0 && normalized <= a1) {
            const t = (normalized - a0) / (a1 - a0);
            return normalizeFrameIndex(f0 + (f1 - f0) * t);
        }
    }

    return spriteConfig.defaultFrame;
}

function directionToFrame(deltaX, deltaY) {
    const angle = Math.atan2(deltaY, deltaX);
    const correctedAngle = spriteConfig.invertDirection ? angle + Math.PI : angle;
    const normalizedAngle = correctedAngle < 0
        ? correctedAngle + fullTurn
        : correctedAngle % fullTurn;
    const degrees = normalizedAngle * 180 / Math.PI;

    if (
        state.lastAngle !== null
        && Math.abs(getSignedAngleDistance(state.lastAngle, degrees)) < spriteConfig.angleDeadZone
    ) {
        return state.renderedFrame < 0 ? spriteConfig.defaultFrame : state.renderedFrame;
    }

    const nextFrame = angleToFrame(degrees);

    if (
        state.renderedFrame >= 0
        && getCircularDistance(nextFrame, state.renderedFrame, totalFrames) <= spriteConfig.frameDeadZone
    ) {
        return state.renderedFrame;
    }

    state.lastAngle = degrees;
    return nextFrame;
}

function pointerToFrame() {
    if (!state.pointerActive) {
        state.lastAngle = null;
        return spriteConfig.defaultFrame;
    }

    if (!state.spriteRect) {
        updateSpriteRect();
    }

    const centerX = state.spriteRect.left + state.spriteRect.width / 2;
    const centerY = state.spriteRect.top + state.spriteRect.height / 2;
    const deltaX = state.pointerX - centerX;
    const deltaY = state.pointerY - centerY;
    const distance = Math.hypot(deltaX, deltaY);
    const lockRadius = Math.min(state.spriteRect.width, state.spriteRect.height) * 0.5 * spriteConfig.nearLockRatio;

    if (distance < lockRadius) {
        state.lastAngle = null;
        return spriteConfig.defaultFrame;
    }

    return directionToFrame(deltaX, deltaY);
}

function orientationToFrame() {
    const x = clamp(state.orientationX / spriteConfig.orientationTilt, -1, 1);
    const y = clamp(state.orientationY / spriteConfig.orientationTilt, -1, 1);

    if (Math.abs(x) < 0.08 && Math.abs(y) < 0.08) {
        state.lastAngle = null;
        return spriteConfig.defaultFrame;
    }

    return directionToFrame(x, y);
}

function render() {
    state.renderScheduled = false;

    if (!state.spriteRect) {
        updateSpriteRect();
    }

    setFrame(state.sensorActive ? orientationToFrame() : pointerToFrame());
}

function setPointer(clientX, clientY) {
    state.pointerX = clientX;
    state.pointerY = clientY;

    if (!state.pointerActive) {
        state.pointerActive = true;
        elements.spriteWindow.classList.remove("is-idle");
    }

    scheduleRender();
}

function handlePointerMove(event) {
    if (state.sensorActive) {
        return;
    }

    setPointer(event.clientX, event.clientY);
}

function handlePointerLeave() {
    if (!state.pointerActive) {
        return;
    }

    state.pointerActive = false;
    state.pointerX = -1000;
    state.pointerY = -1000;
    state.lastAngle = null;
    setFrame(spriteConfig.defaultFrame);
    elements.spriteWindow.classList.add("is-idle");
}

function handleTouchMove(event) {
    if (!event.touches || !event.touches[0] || state.sensorActive) {
        return;
    }

    const touch = event.touches[0];
    setPointer(touch.clientX, touch.clientY);
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
        state.orientationY = typeof event.beta === "number" ? event.beta : 0;
        state.orientationX = typeof event.gamma === "number" ? event.gamma : 0;
        scheduleRender();
    };

    window.addEventListener("deviceorientation", state.orientationHandler, true);
    state.sensorActive = true;
    state.lastAngle = null;
    elements.spriteWindow.classList.remove("is-idle");
    setSensorMessage("感应模式已开启。轻轻转动设备，Jimmy 会跟着你的方向转头。");
    scheduleRender();
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

function markSpriteReady() {
    if (state.spriteReady) {
        return;
    }

    state.spriteReady = true;
    elements.spriteWindow.classList.remove("is-loading");
    elements.spriteWindow.classList.add("is-ready");
    updateSpriteRect();
    scheduleRender();
}

function preloadSprite() {
    elements.spriteWindow.classList.add("is-loading");

    const sprite = new Image();
    sprite.onload = markSpriteReady;
    sprite.onerror = markSpriteReady;
    sprite.src = new URL("./assets/sprite.webp", window.location.href).href;

    window.setTimeout(markSpriteReady, spriteConfig.loaderTimeoutMs);
}

function bindEvents() {
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave, { passive: true });
    window.addEventListener("resize", updateSpriteRect, { passive: true });
    window.addEventListener("scroll", updateSpriteRect, { passive: true });

    elements.spriteWindow.addEventListener("touchstart", handleTouchMove, { passive: true });
    elements.spriteWindow.addEventListener("touchmove", handleTouchMove, { passive: true });

    elements.sensorButton.addEventListener("click", activateSensorMode);
}

function initialize() {
    populateProfile();
    updateSpriteRect();
    setFrame(spriteConfig.defaultFrame);
    elements.spriteWindow.classList.add("is-idle");
    preloadSprite();
    bindEvents();
}

initialize();
