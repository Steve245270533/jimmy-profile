const profile = {
    nameEn: "Jimmy",
    nameZh: "吉咪",
    birthday: "2024.10.21",
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
    frameWidth: 834,
    frameHeight: 1112,
    orientationTilt: 18,
    invertDirection: true,
    nearLockRatio: 0.12,
    angleDeadZone: 2.5,
    frameDeadZone: 1
};

const totalFrames = spriteConfig.validFrames;
const fullTurn = Math.PI * 2;
const spriteAssetUrl = new URL("./assets/sprite.webp", window.location.href).href;

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
    spriteCanvas: document.getElementById("sprite-canvas"),
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
    spriteReady: false,
    frameBitmaps: [],
    sourceImage: null,
    canvasContext: null,
    canvasCssWidth: 0,
    canvasCssHeight: 0,
    canvasPixelRatio: 1
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

function drawFrame(frame) {
    const frameIndex = normalizeFrameIndex(frame);

    if (frameIndex === state.renderedFrame) {
        return;
    }

    state.renderedFrame = frameIndex;

    const frameCanvas = state.frameBitmaps[frameIndex];

    if (!frameCanvas || !state.canvasContext) {
        return;
    }

    state.canvasContext.clearRect(0, 0, state.canvasCssWidth, state.canvasCssHeight);
    state.canvasContext.drawImage(frameCanvas, 0, 0, state.canvasCssWidth, state.canvasCssHeight);
}

function updateSpriteRect() {
    state.spriteRect = elements.spriteWindow.getBoundingClientRect();
    syncCanvasSize();
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

    drawFrame(state.sensorActive ? orientationToFrame() : pointerToFrame());
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
    if (!state.spriteReady || state.sensorActive) {
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
    drawFrame(spriteConfig.defaultFrame);
    elements.spriteWindow.classList.add("is-idle");
}

function handleTouchMove(event) {
    if (!state.spriteReady || !event.touches || !event.touches[0] || state.sensorActive) {
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
    drawFrame(spriteConfig.defaultFrame);
}

function syncCanvasSize() {
    const rect = elements.spriteWindow.getBoundingClientRect();
    const cssWidth = Math.max(1, Math.round(rect.width));
    const cssHeight = Math.max(1, Math.round(rect.height));
    const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    if (
        state.canvasCssWidth === cssWidth
        && state.canvasCssHeight === cssHeight
        && state.canvasPixelRatio === devicePixelRatio
    ) {
        return;
    }

    state.canvasCssWidth = cssWidth;
    state.canvasCssHeight = cssHeight;
    state.canvasPixelRatio = devicePixelRatio;
    elements.spriteCanvas.width = cssWidth * devicePixelRatio;
    elements.spriteCanvas.height = cssHeight * devicePixelRatio;

    if (!state.canvasContext) {
        state.canvasContext = elements.spriteCanvas.getContext("2d", { alpha: true });
    }

    state.canvasContext.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    state.canvasContext.imageSmoothingEnabled = true;
    state.canvasContext.imageSmoothingQuality = "high";

    if (state.spriteReady && state.sourceImage) {
        buildFrameCanvases(state.sourceImage);
        state.renderedFrame = -1;
        drawFrame(state.sensorActive ? orientationToFrame() : pointerToFrame());
    }
}

function buildFrameCanvases(image) {
    const targetWidth = Math.max(1, Math.round(state.spriteRect?.width || elements.spriteWindow.clientWidth || spriteConfig.frameWidth));
    const targetHeight = Math.max(1, Math.round(state.spriteRect?.height || elements.spriteWindow.clientHeight || spriteConfig.frameHeight));

    state.frameBitmaps = Array.from({ length: totalFrames }, (_, frame) => {
        const frameCanvas = document.createElement("canvas");
        frameCanvas.width = targetWidth;
        frameCanvas.height = targetHeight;

        const frameContext = frameCanvas.getContext("2d", { alpha: true });
        frameContext.imageSmoothingEnabled = true;
        frameContext.imageSmoothingQuality = "high";

        const sourceX = (frame % spriteConfig.cols) * spriteConfig.frameWidth;
        const sourceY = Math.floor(frame / spriteConfig.cols) * spriteConfig.frameHeight;

        frameContext.drawImage(
            image,
            sourceX,
            sourceY,
            spriteConfig.frameWidth,
            spriteConfig.frameHeight,
            0,
            0,
            targetWidth,
            targetHeight
        );

        return frameCanvas;
    });
}

async function preloadSprite() {
    elements.spriteWindow.classList.add("is-loading");
    updateSpriteRect();

    const sprite = new Image();
    const spriteLoaded = new Promise((resolve, reject) => {
        sprite.onload = resolve;
        sprite.onerror = reject;
    });
    sprite.src = spriteAssetUrl;
    state.sourceImage = sprite;

    try {
        await spriteLoaded;

        if (typeof sprite.decode === "function") {
            try {
                await sprite.decode();
            } catch (error) {
                // Some browsers can still render the image even when decode() rejects.
                console.warn("Sprite decode fallback to loaded image:", error);
            }
        }
    } catch (error) {
        console.error("Sprite load failed:", error);
        markSpriteReady();
        return;
    }

    buildFrameCanvases(sprite);
    markSpriteReady();
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
    syncCanvasSize();
    elements.spriteWindow.classList.add("is-idle");
    preloadSprite();
    bindEvents();
}

initialize();
