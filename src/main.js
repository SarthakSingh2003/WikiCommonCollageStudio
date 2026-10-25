import { createIcons, icons } from 'lucide';
import { searchWikimediaCommons } from './wikimediaApi.js';
import { DEFAULT_ADJUSTMENTS, FILTER_PRESETS } from './imageProcessing.js';
import { CollagePhoto, CollageEngine } from './collageEngine.js';
import { AnnotationItem } from './annotationEngine.js';
import { ExportEngine } from './exportEngine.js';
import { HistoryManager } from './historyManager.js';

function refreshIcons() {
  createIcons({ icons });
}

document.addEventListener('DOMContentLoaded', async () => {
  const mainCanvas = document.getElementById('main-canvas');
  const overlayCanvas = document.getElementById('overlay-canvas');
  const canvasWrapper = document.getElementById('canvas-wrapper');
  const canvasViewport = document.getElementById('canvas-viewport');

  const engine = new CollageEngine(mainCanvas, overlayCanvas);
  const exportEngine = new ExportEngine(engine);

  const history = new HistoryManager(
    engine,
    state => {
      document.getElementById('btn-undo').disabled = !state.canUndo;
      document.getElementById('btn-redo').disabled = !state.canRedo;
    },
    () => {
      syncControlsToActivePhoto();
      updateLayersList();
      updateFilmstrip();
    }
  );

  let copiedAdjustments = null;

  let zoomLevel = 1.0;
  function updateZoom(newZoom) {
    zoomLevel = Math.max(0.25, Math.min(3.0, newZoom));
    canvasWrapper.style.transform = `scale(${zoomLevel})`;
    document.getElementById('zoom-level-text').textContent = `${Math.round(zoomLevel * 100)}%`;
  }

  function fitZoomToScreen() {
    const rect = canvasViewport.getBoundingClientRect();
    const availableW = rect.width - 80;
    const availableH = rect.height - 120;
    const scale = Math.min(availableW / engine.width, availableH / engine.height, 1.0);
    updateZoom(Math.max(0.3, scale));
  }

  document.getElementById('btn-zoom-in').addEventListener('click', () => updateZoom(zoomLevel + 0.15));
  document.getElementById('btn-zoom-out').addEventListener('click', () => updateZoom(zoomLevel - 0.15));
  document.getElementById('btn-zoom-fit').addEventListener('click', fitZoomToScreen);

  const navTabs = document.querySelectorAll('.nav-tab');
  const inspectorTabs = document.querySelectorAll('.inspector-tab-content');

  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab');
      navTabs.forEach(t => t.classList.remove('active'));
      inspectorTabs.forEach(content => content.classList.remove('active'));

      tab.classList.add('active');
      const content = document.getElementById(`tab-${targetTab}`);
      if (content) content.classList.add('active');

      if (targetTab === 'crop') {
        engine.isCropModeActive = false; // user can toggle explicitly
        document.getElementById('btn-apply-crop').classList.add('hidden');
      } else {
        engine.isCropModeActive = false;
        document.getElementById('btn-apply-crop').classList.add('hidden');
      }

      if (targetTab !== 'retouch') {
        engine.activeBrushMode = 'none';
        document.querySelectorAll('#brush-tool-pills .pill-btn').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-brush') === 'none');
        });
      }

      engine.render();
    });
  });

  const lightSliders = [
    { id: 'slider-exposure', prop: 'exposure', displayId: 'val-exposure', format: v => `${(v / 50).toFixed(1)} EV` },
    { id: 'slider-brightness', prop: 'brightness', displayId: 'val-brightness', format: v => String(v) },
    { id: 'slider-contrast', prop: 'contrast', displayId: 'val-contrast', format: v => String(v) },
    { id: 'slider-highlights', prop: 'highlights', displayId: 'val-highlights', format: v => String(v) },
    { id: 'slider-shadows', prop: 'shadows', displayId: 'val-shadows', format: v => String(v) },
    { id: 'slider-whites', prop: 'whites', displayId: 'val-whites', format: v => String(v) },
    { id: 'slider-blacks', prop: 'blacks', displayId: 'val-blacks', format: v => String(v) },
    { id: 'slider-gamma', prop: 'gamma', displayId: 'val-gamma', format: v => (v / 100).toFixed(2) },
    { id: 'slider-temperature', prop: 'temperature', displayId: 'val-temperature', format: v => String(v) },
    { id: 'slider-tint', prop: 'tint', displayId: 'val-tint', format: v => String(v) },
    { id: 'slider-vibrance', prop: 'vibrance', displayId: 'val-vibrance', format: v => String(v) },
    { id: 'slider-saturation', prop: 'saturation', displayId: 'val-saturation', format: v => String(v) },
    { id: 'slider-hue', prop: 'hue', displayId: 'val-hue', format: v => `${v}°` },
    { id: 'slider-fade', prop: 'fade', displayId: 'val-fade', format: v => String(v) }
  ];

  lightSliders.forEach(({ id, prop, displayId, format }) => {
    const slider = document.getElementById(id);
    const display = document.getElementById(displayId);
    if (!slider) return;

    slider.addEventListener('input', e => {
      const val = parseFloat(e.target.value);
      if (display) display.textContent = format ? format(val) : String(val);

      const activePhoto = engine.getActivePhoto();
      if (activePhoto) {
        activePhoto.adjustments[prop] = val;
        activePhoto.needsProcessing = true;
        engine.render();
      }
    });

    slider.addEventListener('change', () => {
      history.recordChange();
    });
  });

  document.getElementById('btn-reset-light').addEventListener('click', () => {
    const activePhoto = engine.getActivePhoto();
    if (!activePhoto) return;
    lightSliders.forEach(({ prop }) => {
      activePhoto.adjustments[prop] = DEFAULT_ADJUSTMENTS[prop];
    });
    activePhoto.needsProcessing = true;
    syncControlsToActivePhoto();
    engine.render();
    history.recordChange();
  });

  const gradingSliders = [
    { id: 'slider-shadows-hue', prop: 'shadowsHue', displayId: 'val-shadows-hue', format: v => `${v}°` },
    { id: 'slider-shadows-sat', prop: 'shadowsSat', displayId: 'val-shadows-sat', format: v => `${v}%` },
    { id: 'slider-midtones-hue', prop: 'midtonesHue', displayId: 'val-midtones-hue', format: v => `${v}°` },
    { id: 'slider-midtones-sat', prop: 'midtonesSat', displayId: 'val-midtones-sat', format: v => `${v}%` },
    { id: 'slider-highlights-hue', prop: 'highlightsHue', displayId: 'val-highlights-hue', format: v => `${v}°` },
    { id: 'slider-highlights-sat', prop: 'highlightsSat', displayId: 'val-highlights-sat', format: v => `${v}%` },
    { id: 'slider-grading-balance', prop: 'gradingBalance', displayId: 'val-grading-balance', format: v => String(v) },
    { id: 'slider-channel-r', prop: 'channelR', displayId: 'val-channel-r', format: v => String(v) },
    { id: 'slider-channel-g', prop: 'channelG', displayId: 'val-channel-g', format: v => String(v) },
    { id: 'slider-channel-b', prop: 'channelB', displayId: 'val-channel-b', format: v => String(v) },
    { id: 'slider-tone-strength', prop: 'toneStrength', displayId: 'val-tone-strength', format: v => `${v}%` }
  ];

  gradingSliders.forEach(({ id, prop, displayId, format }) => {
    const slider = document.getElementById(id);
    const display = document.getElementById(displayId);
    if (!slider) return;

    slider.addEventListener('input', e => {
      const val = parseFloat(e.target.value);
      if (display) display.textContent = format ? format(val) : String(val);

      const activePhoto = engine.getActivePhoto();
      if (activePhoto) {
        activePhoto.adjustments[prop] = val;
        activePhoto.needsProcessing = true;
        engine.render();
      }
    });

    slider.addEventListener('change', () => {
      history.recordChange();
    });
  });

  const tonePills = document.querySelectorAll('#toning-style-pills .pill-btn');
  tonePills.forEach(pill => {
    pill.addEventListener('click', () => {
      tonePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const tone = pill.getAttribute('data-tone');

      const activePhoto = engine.getActivePhoto();
      if (activePhoto) {
        activePhoto.adjustments.toneStyle = tone;
        activePhoto.needsProcessing = true;
        engine.render();
        history.recordChange();
      }
    });
  });

  document.getElementById('btn-reset-grading').addEventListener('click', () => {
    const activePhoto = engine.getActivePhoto();
    if (!activePhoto) return;
    gradingSliders.forEach(({ prop }) => {
      activePhoto.adjustments[prop] = DEFAULT_ADJUSTMENTS[prop];
    });
    activePhoto.adjustments.toneStyle = 'none';
    activePhoto.needsProcessing = true;
    syncControlsToActivePhoto();
    engine.render();
    history.recordChange();
  });

  const filterCardsContainer = document.getElementById('filter-cards-container');
  const sliderFilterIntensity = document.getElementById('slider-filter-intensity');
  const valFilterIntensity = document.getElementById('val-filter-intensity');

  sliderFilterIntensity.addEventListener('input', e => {
    const val = parseInt(e.target.value, 10);
    valFilterIntensity.textContent = `${val}%`;
    const activePhoto = engine.getActivePhoto();
    if (activePhoto) {
      activePhoto.adjustments.filterIntensity = val;
      activePhoto.needsProcessing = true;
      engine.render();
    }
  });

  sliderFilterIntensity.addEventListener('change', () => history.recordChange());

  function renderFilterCards() {
    filterCardsContainer.innerHTML = '';
    const activePhoto = engine.getActivePhoto();
    const currentPreset = activePhoto ? (activePhoto.adjustments.filterPreset || 'normal') : 'normal';

    FILTER_PRESETS.forEach(preset => {
      const card = document.createElement('div');
      card.className = `filter-card ${preset.id === currentPreset ? 'active' : ''}`;
      card.setAttribute('data-filter', preset.id);

      let bgStyle = '#DDD';
      if (preset.id === 'normal') bgStyle = 'linear-gradient(135deg, #A580E8, #70A9FF)';
      else if (preset.id === 'natural') bgStyle = 'linear-gradient(135deg, #70A9FF, #52B788)';
      else if (preset.id === 'warm') bgStyle = 'linear-gradient(135deg, #FFB5A7, #FDE2E4)';
      else if (preset.id === 'cool') bgStyle = 'linear-gradient(135deg, #BEE1E6, #70A9FF)';
      else if (preset.id === 'vivid') bgStyle = 'linear-gradient(135deg, #FF758F, #FFB5A7)';
      else if (preset.id === 'muted') bgStyle = 'linear-gradient(135deg, #D8D0F5, #E2ECE9)';
      else if (preset.id === 'bw') bgStyle = 'linear-gradient(135deg, #333333, #EEEEEE)';
      else if (preset.id === 'vintage') bgStyle = 'linear-gradient(135deg, #D4A373, #FAEDCD)';
      else if (preset.id === 'cinematic') bgStyle = 'linear-gradient(135deg, #0077B6, #F77F00)';
      else if (preset.id === 'high-contrast') bgStyle = 'linear-gradient(135deg, #111111, #FFFFFF)';
      else if (preset.id === 'soft-bright') bgStyle = 'linear-gradient(135deg, #FFF1E6, #FDE2E4)';
      else if (preset.id === 'documentary') bgStyle = 'linear-gradient(135deg, #6C757D, #ADB5BD)';

      card.innerHTML = `
        <div class="filter-preview-circle" style="background: ${bgStyle};"></div>
        <span class="filter-card-name">${preset.name}</span>
      `;

      card.addEventListener('click', () => {
        applyFilterToActivePhoto(preset);
      });

      filterCardsContainer.appendChild(card);
    });
  }

  function applyFilterToActivePhoto(preset) {
    const activePhoto = engine.getActivePhoto();
    if (!activePhoto) return;

    activePhoto.adjustments.filterPreset = preset.id;
    Object.keys(DEFAULT_ADJUSTMENTS).forEach(key => {
      if (['crop', 'rotation', 'straighten', 'flipH', 'flipV', 'privacyZones', 'cutoutEnabled'].includes(key)) return;
      activePhoto.adjustments[key] = DEFAULT_ADJUSTMENTS[key];
    });

    Object.assign(activePhoto.adjustments, preset.adjustments);
    activePhoto.needsProcessing = true;
    syncControlsToActivePhoto();
    renderFilterCards();
    engine.render();
    history.recordChange();
  }

  document.getElementById('btn-remove-filter').addEventListener('click', () => {
    applyFilterToActivePhoto(FILTER_PRESETS[0]);
  });

  const cropAspectPills = document.querySelectorAll('#crop-aspect-pills .pill-btn');
  let selectedCropRatio = 'free';

  cropAspectPills.forEach(pill => {
    pill.addEventListener('click', () => {
      cropAspectPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedCropRatio = pill.getAttribute('data-crop-aspect');
      updateCropRectFromRatio();
    });
  });

  function updateCropRectFromRatio() {
    const activePhoto = engine.getActivePhoto();
    if (!activePhoto || !activePhoto.slotBounds) return;
    const slot = activePhoto.slotBounds;

    let targetRatio = null;
    if (selectedCropRatio === '1:1') targetRatio = 1.0;
    else if (selectedCropRatio === '4:3') targetRatio = 4 / 3;
    else if (selectedCropRatio === '3:2') targetRatio = 3 / 2;
    else if (selectedCropRatio === '16:9') targetRatio = 16 / 9;
    else if (selectedCropRatio === '9:16') targetRatio = 9 / 16;
    else if (selectedCropRatio === '3:4') targetRatio = 3 / 4;

    if (!targetRatio) {
      engine.activeCropRect = { x: slot.x + 20, y: slot.y + 20, width: slot.width - 40, height: slot.height - 40 };
    } else {
      let cw = slot.width - 40;
      let ch = cw / targetRatio;
      if (ch > slot.height - 40) {
        ch = slot.height - 40;
        cw = ch * targetRatio;
      }
      const cx = slot.x + (slot.width - cw) / 2;
      const cy = slot.y + (slot.height - ch) / 2;
      engine.activeCropRect = { x: cx, y: cy, width: cw, height: ch };
    }
    engine.render();
  }

  const btnToggleCrop = document.getElementById('btn-toggle-crop-mode');
  const btnApplyCrop = document.getElementById('btn-apply-crop');

  btnToggleCrop.addEventListener('click', () => {
    engine.isCropModeActive = !engine.isCropModeActive;
    if (engine.isCropModeActive) {
      document.getElementById('txt-crop-mode').textContent = 'Cancel Crop Mode';
      btnApplyCrop.classList.remove('hidden');
      updateCropRectFromRatio();
    } else {
      document.getElementById('txt-crop-mode').textContent = 'Enable Interactive Crop Box';
      btnApplyCrop.classList.add('hidden');
      engine.activeCropRect = null;
      engine.render();
    }
  });

  btnApplyCrop.addEventListener('click', () => {
    const activePhoto = engine.getActivePhoto();
    if (activePhoto && engine.activeCropRect && activePhoto.slotBounds) {
      const slot = activePhoto.slotBounds;
      const cr = engine.activeCropRect;
      const normCrop = {
        x: Math.max(0, (cr.x - slot.x) / slot.width),
        y: Math.max(0, (cr.y - slot.y) / slot.height),
        width: Math.min(1, cr.width / slot.width),
        height: Math.min(1, cr.height / slot.height)
      };
      activePhoto.adjustments.crop = normCrop;
      activePhoto.needsProcessing = true;
    }
    engine.isCropModeActive = false;
    document.getElementById('txt-crop-mode').textContent = 'Enable Interactive Crop Box';
    btnApplyCrop.classList.add('hidden');
    engine.activeCropRect = null;
    engine.render();
    history.recordChange();
  });

  document.getElementById('btn-reset-crop').addEventListener('click', () => {
    const activePhoto = engine.getActivePhoto();
    if (!activePhoto) return;
    activePhoto.adjustments.crop = null;
    activePhoto.adjustments.straighten = 0;
    activePhoto.adjustments.rotation = 0;
    activePhoto.adjustments.flipH = false;
    activePhoto.adjustments.flipV = false;
    activePhoto.needsProcessing = true;
    document.getElementById('slider-straighten').value = 0;
    document.getElementById('val-straighten').textContent = '0.0°';
    document.getElementById('slider-rotation').value = 0;
    document.getElementById('val-rotation').textContent = '0°';
    engine.isCropModeActive = false;
    btnApplyCrop.classList.add('hidden');
    engine.render();
    history.recordChange();
  });

  document.querySelectorAll('#crop-guides-pills .pill-btn').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#crop-guides-pills .pill-btn').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      engine.cropGuide = pill.getAttribute('data-guide');
      engine.render();
    });
  });

  const sliderStraighten = document.getElementById('slider-straighten');
  sliderStraighten.addEventListener('input', e => {
    const val = parseFloat(e.target.value);
    document.getElementById('val-straighten').textContent = `${val.toFixed(1)}°`;
    const activePhoto = engine.getActivePhoto();
    if (activePhoto) {
      activePhoto.adjustments.straighten = val;
      engine.render();
    }
  });
  sliderStraighten.addEventListener('change', () => history.recordChange());

  const sliderRotation = document.getElementById('slider-rotation');
  sliderRotation.addEventListener('input', e => {
    const val = parseInt(e.target.value, 10);
    document.getElementById('val-rotation').textContent = `${val}°`;
    const activePhoto = engine.getActivePhoto();
    if (activePhoto) {
      activePhoto.adjustments.rotation = val;
      engine.render();
    }
  });
  sliderRotation.addEventListener('change', () => history.recordChange());

  document.getElementById('btn-rotate-ccw').addEventListener('click', () => {
    const activePhoto = engine.getActivePhoto();
    if (!activePhoto) return;
    activePhoto.adjustments.rotation = ((activePhoto.adjustments.rotation || 0) - 90 + 360) % 360;
    sliderRotation.value = activePhoto.adjustments.rotation;
    document.getElementById('val-rotation').textContent = `${activePhoto.adjustments.rotation}°`;
    engine.render();
    history.recordChange();
  });

  document.getElementById('btn-rotate-cw').addEventListener('click', () => {
    const activePhoto = engine.getActivePhoto();
    if (!activePhoto) return;
    activePhoto.adjustments.rotation = ((activePhoto.adjustments.rotation || 0) + 90) % 360;
    sliderRotation.value = activePhoto.adjustments.rotation;
    document.getElementById('val-rotation').textContent = `${activePhoto.adjustments.rotation}°`;
    engine.render();
    history.recordChange();
  });

  document.getElementById('btn-flip-h').addEventListener('click', () => {
    const activePhoto = engine.getActivePhoto();
    if (!activePhoto) return;
    activePhoto.adjustments.flipH = !activePhoto.adjustments.flipH;
    engine.render();
    history.recordChange();
  });

  document.getElementById('btn-flip-v').addEventListener('click', () => {
    const activePhoto = engine.getActivePhoto();
    if (!activePhoto) return;
    activePhoto.adjustments.flipV = !activePhoto.adjustments.flipV;
    engine.render();
    history.recordChange();
  });

  const detailSliders = [
    { id: 'slider-sharpen', prop: 'sharpen', displayId: 'val-sharpen', format: v => String(v) },
    { id: 'slider-clarity', prop: 'clarity', displayId: 'val-clarity', format: v => String(v) },
    { id: 'slider-blur', prop: 'blur', displayId: 'val-blur', format: v => `${v} px` },
    { id: 'slider-vignette', prop: 'vignette', displayId: 'val-vignette', format: v => String(v) },
    { id: 'slider-grain', prop: 'grain', displayId: 'val-grain', format: v => String(v) }
  ];

  detailSliders.forEach(({ id, prop, displayId, format }) => {
    const slider = document.getElementById(id);
    const display = document.getElementById(displayId);
    if (!slider) return;

    slider.addEventListener('input', e => {
      const val = parseInt(e.target.value, 10);
      if (display) display.textContent = format(val);
      const activePhoto = engine.getActivePhoto();
      if (activePhoto) {
        activePhoto.adjustments[prop] = val;
        activePhoto.needsProcessing = true;
        engine.render();
      }
    });

    slider.addEventListener('change', () => history.recordChange());
  });

  document.getElementById('btn-reset-detail').addEventListener('click', () => {
    const activePhoto = engine.getActivePhoto();
    if (!activePhoto) return;
    detailSliders.forEach(({ prop }) => {
      activePhoto.adjustments[prop] = 0;
    });
    activePhoto.needsProcessing = true;
    syncControlsToActivePhoto();
    engine.render();
    history.recordChange();
  });

  const privacyZonesList = document.getElementById('privacy-zones-list');
  const viewportBanner = document.getElementById('viewport-banner');
  document.getElementById('banner-close').addEventListener('click', () => viewportBanner.classList.add('hidden'));

  function showPrivacyDisclaimer() {
    viewportBanner.classList.remove('hidden');
  }

  function addPrivacyZone(type = 'blur') {
    const activePhoto = engine.getActivePhoto();
    if (!activePhoto) return;

    // Use normalized coordinates (0..1)
    const zone = {
      id: `zone-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type: type,
      x: 0.3,
      y: 0.25,
      width: 0.35,
      height: 0.25,
      strength: type === 'pixel' ? 16 : 15
    };

    if (!activePhoto.adjustments.privacyZones) activePhoto.adjustments.privacyZones = [];
    activePhoto.adjustments.privacyZones.push(zone);
    engine.activePrivacyZoneIndex = activePhoto.adjustments.privacyZones.length - 1;
    activePhoto.needsProcessing = true;

    showPrivacyDisclaimer();
    renderPrivacyZonesList();
    engine.render();
    history.recordChange();
  }

  document.getElementById('btn-add-privacy-blur').addEventListener('click', () => addPrivacyZone('blur'));
  document.getElementById('btn-add-privacy-pixel').addEventListener('click', () => addPrivacyZone('pixel'));

  function renderPrivacyZonesList() {
    privacyZonesList.innerHTML = '';
    const activePhoto = engine.getActivePhoto();
    if (!activePhoto || !activePhoto.adjustments.privacyZones) return;

    activePhoto.adjustments.privacyZones.forEach((zone, idx) => {
      const isSelected = (idx === engine.activePrivacyZoneIndex);
      const item = document.createElement('div');
      item.className = `privacy-zone-item ${isSelected ? 'active' : ''}`;
      item.style.flexDirection = 'column';
      item.style.alignItems = 'stretch';
      item.style.gap = '6px';
      item.style.cursor = 'pointer';

      item.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-weight:700; color:${zone.type === 'pixel' ? '#9333EA' : '#059669'};">
            ${zone.type === 'pixel' ? '▦' : '👁'} Zone ${idx + 1} (${zone.type.toUpperCase()})
          </span>
          <button class="delete-zone-btn" title="Remove Zone">&times;</button>
        </div>
        <div style="display:flex; align-items:center; gap:8px; font-size:10px;">
          <span>${zone.type === 'pixel' ? 'Pixel Size' : 'Blur Radius'}:</span>
          <input type="range" class="zone-strength-slider" min="4" max="40" value="${zone.strength || (zone.type === 'pixel' ? 16 : 15)}" style="flex:1;" />
          <span class="zone-strength-val" style="min-width:24px; font-weight:600;">${zone.strength || (zone.type === 'pixel' ? 16 : 15)}</span>
        </div>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.delete-zone-btn') || e.target.closest('.zone-strength-slider')) return;
        engine.activePrivacyZoneIndex = idx;
        renderPrivacyZonesList();
        engine.renderOverlays();
      });

      const strengthSlider = item.querySelector('.zone-strength-slider');
      const strengthVal = item.querySelector('.zone-strength-val');
      strengthSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        zone.strength = val;
        strengthVal.textContent = String(val);
        activePhoto.needsProcessing = true;
        engine.render();
      });
      strengthSlider.addEventListener('change', () => history.recordChange());

      item.querySelector('.delete-zone-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        activePhoto.adjustments.privacyZones.splice(idx, 1);
        if (engine.activePrivacyZoneIndex >= activePhoto.adjustments.privacyZones.length) {
          engine.activePrivacyZoneIndex = activePhoto.adjustments.privacyZones.length - 1;
        }
        activePhoto.needsProcessing = true;
        renderPrivacyZonesList();
        engine.render();
        history.recordChange();
      });

      privacyZonesList.appendChild(item);
    });
  }

  const chkCutoutEnable = document.getElementById('chk-cutout-enable');
  const chkCutoutInvert = document.getElementById('chk-cutout-invert');
  const cutoutColorInput = document.getElementById('cutout-color-input');
  const cutoutTargetSwatch = document.getElementById('cutout-target-swatch');
  const sliderCutoutTol = document.getElementById('slider-cutout-tolerance');
  const sliderCutoutFeather = document.getElementById('slider-cutout-feather');

  const btnSampleCutout = document.getElementById('btn-sample-cutout-color');
  if (btnSampleCutout) {
    btnSampleCutout.addEventListener('click', async () => {
      if (window.EyeDropper) {
        try {
          const eyeDropper = new EyeDropper();
          const result = await eyeDropper.open();
          if (result && result.sRGBHex) {
            cutoutColorInput.value = result.sRGBHex;
            cutoutTargetSwatch.style.background = result.sRGBHex;
            const activePhoto = engine.getActivePhoto();
            if (activePhoto) {
              activePhoto.adjustments.cutoutColor = result.sRGBHex;
              activePhoto.adjustments.cutoutEnabled = true;
              chkCutoutEnable.checked = true;
              activePhoto.needsProcessing = true;
              engine.render();
              history.recordChange();
            }
          }
        } catch (_) {}
      } else {
        cutoutColorInput.click();
      }
    });
  }

  chkCutoutEnable.addEventListener('change', e => {
    const activePhoto = engine.getActivePhoto();
    if (activePhoto) {
      activePhoto.adjustments.cutoutEnabled = e.target.checked;
      activePhoto.needsProcessing = true;
      engine.render();
      history.recordChange();
    }
  });

  chkCutoutInvert.addEventListener('change', e => {
    const activePhoto = engine.getActivePhoto();
    if (activePhoto) {
      activePhoto.adjustments.cutoutInvert = e.target.checked;
      activePhoto.needsProcessing = true;
      engine.render();
      history.recordChange();
    }
  });

  cutoutColorInput.addEventListener('input', e => {
    cutoutTargetSwatch.style.background = e.target.value;
    const activePhoto = engine.getActivePhoto();
    if (activePhoto) {
      activePhoto.adjustments.cutoutColor = e.target.value;
      activePhoto.needsProcessing = true;
      engine.render();
    }
  });
  cutoutColorInput.addEventListener('change', () => history.recordChange());

  sliderCutoutTol.addEventListener('input', e => {
    const val = parseInt(e.target.value, 10);
    document.getElementById('val-cutout-tolerance').textContent = String(val);
    const activePhoto = engine.getActivePhoto();
    if (activePhoto) {
      activePhoto.adjustments.cutoutTolerance = val;
      activePhoto.needsProcessing = true;
      engine.render();
    }
  });
  sliderCutoutTol.addEventListener('change', () => history.recordChange());

  sliderCutoutFeather.addEventListener('input', e => {
    const val = parseInt(e.target.value, 10);
    document.getElementById('val-cutout-feather').textContent = `${val} px`;
    const activePhoto = engine.getActivePhoto();
    if (activePhoto) {
      activePhoto.adjustments.cutoutFeather = val;
      activePhoto.needsProcessing = true;
      engine.render();
    }
  });

  document.getElementById('btn-reset-cutout').addEventListener('click', () => {
    const activePhoto = engine.getActivePhoto();
    if (!activePhoto) return;
    activePhoto.adjustments.cutoutEnabled = false;
    chkCutoutEnable.checked = false;
    activePhoto.needsProcessing = true;
    engine.render();
    history.recordChange();
  });

  const chkShadowEnable = document.getElementById('chk-shadow-enable');
  const sliderShadowBlur = document.getElementById('slider-shadow-blur');
  const sliderShadowOpacity = document.getElementById('slider-shadow-opacity');

  chkShadowEnable.addEventListener('change', e => {
    const activePhoto = engine.getActivePhoto();
    if (activePhoto) {
      activePhoto.adjustments.shadowEnabled = e.target.checked;
      engine.render();
      history.recordChange();
    }
  });

  sliderShadowBlur.addEventListener('input', e => {
    const val = parseInt(e.target.value, 10);
    document.getElementById('val-shadow-blur').textContent = `${val} px`;
    const activePhoto = engine.getActivePhoto();
    if (activePhoto) {
      activePhoto.adjustments.shadowBlur = val;
      engine.render();
    }
  });

  sliderShadowOpacity.addEventListener('input', e => {
    const val = parseInt(e.target.value, 10);
    document.getElementById('val-shadow-opacity').textContent = `${val}%`;
    const activePhoto = engine.getActivePhoto();
    if (activePhoto) {
      activePhoto.adjustments.shadowOpacity = val;
      engine.render();
    }
  });

  function syncFreeformInspector() {
    const activePhoto = engine.getActivePhoto();
    const ffSec = document.getElementById('section-freeform-controls');
    if (!ffSec) return;

    if (engine.layout === 'freeform') {
      ffSec.classList.remove('hidden');
    } else {
      ffSec.classList.add('hidden');
      return;
    }

    if (!activePhoto || !activePhoto.freeformBounds) return;
    const b = activePhoto.freeformBounds;

    const inputX = document.getElementById('input-ff-x');
    const inputY = document.getElementById('input-ff-y');
    const inputW = document.getElementById('input-ff-w');
    const inputH = document.getElementById('input-ff-h');
    const btnLock = document.getElementById('btn-ff-aspect-lock');

    if (inputX && document.activeElement !== inputX) inputX.value = Math.round(b.x);
    if (inputY && document.activeElement !== inputY) inputY.value = Math.round(b.y);
    if (inputW && document.activeElement !== inputW) inputW.value = Math.round(b.width);
    if (inputH && document.activeElement !== inputH) inputH.value = Math.round(b.height);

    if (btnLock) {
      const isLocked = activePhoto.lockAspectRatio !== false;
      btnLock.classList.toggle('active', isLocked);
      const span = btnLock.querySelector('span');
      if (span) span.textContent = isLocked ? 'Proportional' : 'Free Aspect';
    }
  }

  const inputFfX = document.getElementById('input-ff-x');
  const inputFfY = document.getElementById('input-ff-y');
  const inputFfW = document.getElementById('input-ff-w');
  const inputFfH = document.getElementById('input-ff-h');
  const btnFfLock = document.getElementById('btn-ff-aspect-lock');

  if (inputFfX) {
    inputFfX.addEventListener('input', e => {
      const activePhoto = engine.getActivePhoto();
      if (activePhoto && activePhoto.freeformBounds) {
        activePhoto.freeformBounds.x = parseInt(e.target.value, 10) || 0;
        engine.render();
      }
    });
    inputFfX.addEventListener('change', () => history.recordChange());
  }

  if (inputFfY) {
    inputFfY.addEventListener('input', e => {
      const activePhoto = engine.getActivePhoto();
      if (activePhoto && activePhoto.freeformBounds) {
        activePhoto.freeformBounds.y = parseInt(e.target.value, 10) || 0;
        engine.render();
      }
    });
    inputFfY.addEventListener('change', () => history.recordChange());
  }

  if (inputFfW) {
    inputFfW.addEventListener('input', e => {
      const activePhoto = engine.getActivePhoto();
      if (activePhoto && activePhoto.freeformBounds) {
        const val = Math.max(40, parseInt(e.target.value, 10) || 40);
        const aspect = (activePhoto.img && activePhoto.img.naturalWidth && activePhoto.img.naturalHeight)
          ? (activePhoto.img.naturalWidth / activePhoto.img.naturalHeight)
          : (activePhoto.freeformBounds.width / activePhoto.freeformBounds.height);
        activePhoto.freeformBounds.width = val;
        if (activePhoto.lockAspectRatio !== false) {
          activePhoto.freeformBounds.height = Math.round(val / aspect);
          if (inputFfH) inputFfH.value = activePhoto.freeformBounds.height;
        }
        engine.render();
      }
    });
    inputFfW.addEventListener('change', () => history.recordChange());
  }

  if (inputFfH) {
    inputFfH.addEventListener('input', e => {
      const activePhoto = engine.getActivePhoto();
      if (activePhoto && activePhoto.freeformBounds) {
        const val = Math.max(40, parseInt(e.target.value, 10) || 40);
        const aspect = (activePhoto.img && activePhoto.img.naturalWidth && activePhoto.img.naturalHeight)
          ? (activePhoto.img.naturalWidth / activePhoto.img.naturalHeight)
          : (activePhoto.freeformBounds.width / activePhoto.freeformBounds.height);
        activePhoto.freeformBounds.height = val;
        if (activePhoto.lockAspectRatio !== false) {
          activePhoto.freeformBounds.width = Math.round(val * aspect);
          if (inputFfW) inputFfW.value = activePhoto.freeformBounds.width;
        }
        engine.render();
      }
    });
    inputFfH.addEventListener('change', () => history.recordChange());
  }

  if (btnFfLock) {
    btnFfLock.addEventListener('click', () => {
      const activePhoto = engine.getActivePhoto();
      if (activePhoto) {
        activePhoto.lockAspectRatio = activePhoto.lockAspectRatio === false ? true : false;
        syncFreeformInspector();
      }
    });
  }

  document.getElementById('btn-ff-reset-aspect')?.addEventListener('click', () => {
    engine.resetActivePhotoFreeformAspect();
    syncFreeformInspector();
    history.recordChange();
  });

  document.getElementById('btn-ff-center')?.addEventListener('click', () => {
    engine.centerActivePhotoFreeform();
    syncFreeformInspector();
    history.recordChange();
  });

  document.getElementById('btn-ff-fit')?.addEventListener('click', () => {
    engine.fitActivePhotoFreeform();
    syncFreeformInspector();
    history.recordChange();
  });

  document.getElementById('btn-ff-rotate-left')?.addEventListener('click', () => {
    const activePhoto = engine.getActivePhoto();
    if (activePhoto) {
      activePhoto.adjustments.rotation = ((activePhoto.adjustments.rotation || 0) - 90 + 360) % 360;
      engine.render();
      history.recordChange();
    }
  });

  document.getElementById('btn-ff-rotate-right')?.addEventListener('click', () => {
    const activePhoto = engine.getActivePhoto();
    if (activePhoto) {
      activePhoto.adjustments.rotation = ((activePhoto.adjustments.rotation || 0) + 90) % 360;
      engine.render();
      history.recordChange();
    }
  });

  document.getElementById('btn-ff-cascade-all')?.addEventListener('click', () => {
    engine.cascadeFreeformPhotos();
    syncFreeformInspector();
    history.recordChange();
  });

  document.querySelectorAll('.layout-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.layout-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const newLayout = card.getAttribute('data-layout');
      engine.layout = newLayout;
      if (newLayout === 'freeform') {
        const p = engine.padding;
        const innerW = engine.width - p * 2;
        const innerH = engine.height - p * 2;
        engine.photos.forEach((photo, idx) => {
          if (!photo.freeformBounds) {
            const aspect = (photo.img && photo.img.naturalWidth && photo.img.naturalHeight)
              ? (photo.img.naturalWidth / photo.img.naturalHeight)
              : (4 / 3);
            const fw = Math.min(innerW * 0.45, 460);
            const fh = Math.round(fw / Math.max(0.2, aspect));
            const offsetX = p + (idx * 60) % Math.max(20, innerW - fw);
            const offsetY = p + (idx * 50) % Math.max(20, innerH - fh);
            photo.freeformBounds = { x: Math.round(offsetX), y: Math.round(offsetY), width: Math.round(fw), height: Math.round(fh) };
          }
        });
        syncFreeformInspector();
      } else {
        const ffSec = document.getElementById('section-freeform-controls');
        if (ffSec) ffSec.classList.add('hidden');
      }
      engine.render();
      history.recordChange();
    });
  });

  const sliderSpacing = document.getElementById('slider-spacing');
  sliderSpacing.addEventListener('input', e => {
    const val = parseInt(e.target.value, 10);
    document.getElementById('val-spacing').textContent = `${val} px`;
    engine.spacing = val;
    engine.render();
  });
  sliderSpacing.addEventListener('change', () => history.recordChange());

  const sliderPadding = document.getElementById('slider-padding');
  sliderPadding.addEventListener('input', e => {
    const val = parseInt(e.target.value, 10);
    document.getElementById('val-padding').textContent = `${val} px`;
    engine.padding = val;
    engine.render();
  });
  sliderPadding.addEventListener('change', () => history.recordChange());

  const sliderRadius = document.getElementById('slider-radius');
  sliderRadius.addEventListener('input', e => {
    const val = parseInt(e.target.value, 10);
    document.getElementById('val-radius').textContent = `${val} px`;
    engine.cornerRadius = val;
    engine.render();
  });
  sliderRadius.addEventListener('change', () => history.recordChange());

  document.querySelectorAll('#canvas-bg-swatches .color-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      document.querySelectorAll('#canvas-bg-swatches .color-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      engine.bgColor = swatch.getAttribute('data-color');
      engine.transparentBg = false;
      document.getElementById('chk-transparent-bg').checked = false;
      engine.render();
      history.recordChange();
    });
  });

  const canvasBgPicker = document.getElementById('canvas-bg-color-picker');
  canvasBgPicker.addEventListener('input', e => {
    engine.bgColor = e.target.value;
    engine.transparentBg = false;
    document.getElementById('chk-transparent-bg').checked = false;
    engine.render();
  });
  canvasBgPicker.addEventListener('change', () => history.recordChange());

  document.getElementById('chk-transparent-bg').addEventListener('change', e => {
    engine.transparentBg = e.target.checked;
    engine.render();
    history.recordChange();
  });

  const aspectPills = document.querySelectorAll('#canvas-aspect-pills .pill-btn');
  const customDimsRow = document.getElementById('custom-dims-row');

  aspectPills.forEach(pill => {
    pill.addEventListener('click', () => {
      aspectPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const aspect = pill.getAttribute('data-aspect');
      engine.aspectRatio = aspect;

      if (aspect === 'custom') {
        customDimsRow.classList.remove('hidden');
      } else {
        customDimsRow.classList.add('hidden');
        if (aspect === '4:3') engine.setDimensions(1200, 900);
        else if (aspect === '16:9') engine.setDimensions(1280, 720);
        else if (aspect === '1:1') engine.setDimensions(1080, 1080);
        else if (aspect === '3:2') engine.setDimensions(1200, 800);
        else if (aspect === '9:16') engine.setDimensions(720, 1280);

        document.getElementById('canvas-dimension-badge').textContent = `${engine.width} × ${engine.height} px`;
        fitZoomToScreen();
      }
    });
  });

  document.getElementById('btn-apply-dims').addEventListener('click', () => {
    const w = parseInt(document.getElementById('canvas-width-input').value, 10) || 1200;
    const h = parseInt(document.getElementById('canvas-height-input').value, 10) || 900;
    engine.setDimensions(w, h);
    document.getElementById('canvas-dimension-badge').textContent = `${engine.width} × ${engine.height} px`;
    fitZoomToScreen();
  });

  document.getElementById('btn-batch-apply-adjustments').addEventListener('click', () => {
    const activePhoto = engine.getActivePhoto();
    if (!activePhoto) return;
    const adjCopy = JSON.parse(JSON.stringify(activePhoto.adjustments));
    engine.photos.forEach(p => {
      p.adjustments = JSON.parse(JSON.stringify(adjCopy));
      p.needsProcessing = true;
    });
    engine.render();
    history.recordChange();
  });

  document.getElementById('btn-batch-reset-all').addEventListener('click', () => {
    engine.photos.forEach(p => {
      p.adjustments = JSON.parse(JSON.stringify(DEFAULT_ADJUSTMENTS));
      p.retouchStrokes = [];
      p.needsProcessing = true;
    });
    syncControlsToActivePhoto();
    engine.render();
    history.recordChange();
  });

  document.getElementById('btn-quick-copy-adj').addEventListener('click', () => {
    const activePhoto = engine.getActivePhoto();
    if (!activePhoto) return;
    copiedAdjustments = JSON.parse(JSON.stringify(activePhoto.adjustments));
  });

  document.getElementById('btn-quick-paste-adj').addEventListener('click', () => {
    const activePhoto = engine.getActivePhoto();
    if (!activePhoto || !copiedAdjustments) return;
    activePhoto.adjustments = JSON.parse(JSON.stringify(copiedAdjustments));
    activePhoto.needsProcessing = true;
    syncControlsToActivePhoto();
    engine.render();
    history.recordChange();
  });

  document.getElementById('btn-quick-apply-all').addEventListener('click', () => {
    document.getElementById('btn-batch-apply-adjustments').click();
  });

  document.getElementById('btn-quick-reset').addEventListener('click', () => {
    const activePhoto = engine.getActivePhoto();
    if (!activePhoto) return;
    activePhoto.adjustments = JSON.parse(JSON.stringify(DEFAULT_ADJUSTMENTS));
    activePhoto.needsProcessing = true;
    syncControlsToActivePhoto();
    engine.render();
    history.recordChange();
  });

  document.getElementById('btn-undo').addEventListener('click', () => history.undo());
  document.getElementById('btn-redo').addEventListener('click', () => history.redo());

  const btnHoldOriginal = document.getElementById('btn-hold-original');
  const startHold = () => {
    engine.holdOriginalMode = true;
    engine.render();
  };
  const endHold = () => {
    engine.holdOriginalMode = false;
    engine.render();
  };
  btnHoldOriginal.addEventListener('mousedown', startHold);
  btnHoldOriginal.addEventListener('mouseup', endHold);
  btnHoldOriginal.addEventListener('mouseleave', endHold);
  btnHoldOriginal.addEventListener('touchstart', startHold);
  btnHoldOriginal.addEventListener('touchend', endHold);

  const btnCompareSplit = document.getElementById('btn-compare-split');
  const splitSliderLine = document.getElementById('split-slider-line');

  btnCompareSplit.addEventListener('click', () => {
    engine.showSplitComparison = !engine.showSplitComparison;
    btnCompareSplit.classList.toggle('active', engine.showSplitComparison);
    splitSliderLine.classList.toggle('hidden', !engine.showSplitComparison);
    updateSplitHandlePosition();
    engine.render();
  });

  function updateSplitHandlePosition() {
    const activePhoto = engine.getActivePhoto();
    if (!activePhoto || !activePhoto.slotBounds) return;
    const slot = activePhoto.slotBounds;
    const splitX = slot.x + slot.width * engine.splitRatio;
    splitSliderLine.style.left = `${splitX}px`;
    splitSliderLine.style.top = `${slot.y}px`;
    splitSliderLine.style.height = `${slot.height}px`;
  }

  let nextPinNumber = 1;

  function addAnnotation(type) {
    const activePhoto = engine.getActivePhoto();
    const cx = activePhoto && activePhoto.slotBounds ? activePhoto.slotBounds.x + activePhoto.slotBounds.width / 2 : engine.width / 2;
    const cy = activePhoto && activePhoto.slotBounds ? activePhoto.slotBounds.y + activePhoto.slotBounds.height / 2 : engine.height / 2;

    let annot;
    if (type === 'title') {
      annot = new AnnotationItem({ type: 'title', text: 'Composition Title', x: cx, y: cy - 80, fontSize: 34, fontWeight: '800' });
    } else if (type === 'text') {
      annot = new AnnotationItem({ type: 'text', text: 'Add descriptive explanatory notes here', x: cx, y: cy, fontSize: 18 });
    } else if (type === 'caption') {
      const captionText = activePhoto ? `${activePhoto.meta.title} — ${activePhoto.meta.author} (${activePhoto.meta.license})` : 'Archival Observation Note';
      annot = new AnnotationItem({ type: 'caption', text: captionText, x: cx, y: cy + 100, fontSize: 14, hasBg: true, fillColor: 'rgba(255,255,255,0.92)' });
    } else if (type === 'pin') {
      annot = new AnnotationItem({ type: 'pin', pinNumber: nextPinNumber++, x: cx, y: cy, fontSize: 20 });
    } else if (type === 'arrow') {
      annot = new AnnotationItem({ type: 'arrow', x: cx - 60, y: cy - 40, endX: cx + 60, endY: cy + 40, strokeWidth: 4 });
    } else if (type === 'rect') {
      annot = new AnnotationItem({ type: 'rect', width: 160, height: 110, x: cx, y: cy, hasBg: false, strokeWidth: 3, strokeColor: '#A580E8', color: '#A580E8', fillColor: '#FFFFFF' });
    } else if (type === 'circle') {
      annot = new AnnotationItem({ type: 'circle', width: 120, height: 120, x: cx, y: cy, hasBg: false, strokeWidth: 3, strokeColor: '#E57399', color: '#E57399', fillColor: '#FFFFFF' });
    } else if (type === 'callout') {
      annot = new AnnotationItem({ type: 'callout', text: 'Important specimen feature', x: cx, y: cy, width: 200, height: 60, fontSize: 16, strokeColor: '#A580E8', fillColor: '#FFFFFF' });
    }

    engine.annotations.push(annot);
    engine.activeAnnotationIndex = engine.annotations.length - 1;
    syncAnnotationInspector();
    updateLayersList();
    engine.render();
    history.recordChange();
  }

  document.getElementById('btn-add-title').addEventListener('click', () => addAnnotation('title'));
  document.getElementById('btn-add-text').addEventListener('click', () => addAnnotation('text'));
  document.getElementById('btn-add-caption').addEventListener('click', () => addAnnotation('caption'));
  document.getElementById('btn-add-pin').addEventListener('click', () => addAnnotation('pin'));
  document.getElementById('btn-add-arrow').addEventListener('click', () => addAnnotation('arrow'));
  document.getElementById('btn-add-rect').addEventListener('click', () => addAnnotation('rect'));
  document.getElementById('btn-add-circle').addEventListener('click', () => addAnnotation('circle'));
  document.getElementById('btn-add-callout').addEventListener('click', () => addAnnotation('callout'));

  const annotTextInput = document.getElementById('annot-text-input');
  const annotFontFamily = document.getElementById('annot-font-family');
  const annotFontSize = document.getElementById('annot-font-size');
  const annotColorPicker = document.getElementById('annot-color-picker');
  const annotBgColorPicker = document.getElementById('annot-bg-color-picker');
  const chkAnnotBg = document.getElementById('chk-annot-bg');
  const sliderAnnotOpacity = document.getElementById('slider-annot-opacity');
  const annotWidthInput = document.getElementById('annot-width-input');
  const annotHeightInput = document.getElementById('annot-height-input');
  const sliderAnnotStroke = document.getElementById('slider-annot-stroke');

  function ensureHexColor(col) {
    if (!col) return '#9333ea';
    if (/^#[0-9A-Fa-f]{6}$/.test(col)) return col;
    if (/^#[0-9A-Fa-f]{3}$/.test(col)) {
      return '#' + col[1] + col[1] + col[2] + col[2] + col[3] + col[3];
    }
    const m = col.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (m) {
      const r = parseInt(m[1], 10).toString(16).padStart(2, '0');
      const g = parseInt(m[2], 10).toString(16).padStart(2, '0');
      const b = parseInt(m[3], 10).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }
    return '#9333ea';
  }

  function syncAnnotationInspector() {
    const annot = engine.annotations[engine.activeAnnotationIndex];
    const editFields = document.getElementById('annotation-edit-fields');
    const emptyMsg = document.getElementById('no-annotation-selected-msg');

    if (!annot) {
      editFields.classList.add('hidden');
      emptyMsg.classList.remove('hidden');
      return;
    }

    editFields.classList.remove('hidden');
    emptyMsg.classList.add('hidden');

    const isShape = annot.type === 'rect' || annot.type === 'circle' || annot.type === 'arrow';

    const textGroup = document.getElementById('annot-text-group');
    if (textGroup) textGroup.classList.toggle('hidden', isShape);

    const fontGroup = document.getElementById('annot-font-group');
    if (fontGroup) fontGroup.classList.toggle('hidden', isShape);

    const dimsGroup = document.getElementById('annot-dims-row');
    if (dimsGroup) dimsGroup.classList.toggle('hidden', annot.type === 'arrow');

    const strokeGroup = document.getElementById('annot-stroke-group');
    if (strokeGroup) strokeGroup.classList.toggle('hidden', annot.type === 'pin');

    const lblColor = document.getElementById('lbl-annot-color');
    if (lblColor) lblColor.textContent = isShape ? 'Border / Line Color' : 'Text / Border Color';

    annotTextInput.value = annot.text || '';
    annotFontFamily.value = annot.fontFamily || "'Plus Jakarta Sans', sans-serif";
    annotFontSize.value = annot.fontSize || 24;

    const strokeCol = annot.strokeColor || annot.color || '#9333EA';
    annotColorPicker.value = ensureHexColor(strokeCol);
    annotBgColorPicker.value = ensureHexColor(annot.fillColor || '#FFFFFF');
    chkAnnotBg.checked = !!annot.hasBg;

    sliderAnnotOpacity.value = Math.round((annot.opacity !== undefined ? annot.opacity : 1) * 100);
    document.getElementById('val-annot-opacity').textContent = `${Math.round((annot.opacity !== undefined ? annot.opacity : 1) * 100)}%`;

    if (annotWidthInput && document.activeElement !== annotWidthInput) {
      annotWidthInput.value = Math.round(annot.width || 120);
    }
    if (annotHeightInput && document.activeElement !== annotHeightInput) {
      annotHeightInput.value = Math.round(annot.height || 120);
    }

    if (sliderAnnotStroke) {
      const sw = annot.strokeWidth !== undefined ? annot.strokeWidth : 3;
      sliderAnnotStroke.value = sw;
      const valStroke = document.getElementById('val-annot-stroke');
      if (valStroke) valStroke.textContent = `${sw} px`;
    }
  }

  annotTextInput.addEventListener('input', e => {
    const annot = engine.annotations[engine.activeAnnotationIndex];
    if (annot) {
      annot.text = e.target.value;
      engine.render();
    }
  });

  annotFontFamily.addEventListener('change', e => {
    const annot = engine.annotations[engine.activeAnnotationIndex];
    if (annot) {
      annot.fontFamily = e.target.value;
      engine.render();
      history.recordChange();
    }
  });

  annotFontSize.addEventListener('input', e => {
    const annot = engine.annotations[engine.activeAnnotationIndex];
    if (annot) {
      annot.fontSize = parseInt(e.target.value, 10) || 20;
      engine.render();
    }
  });

  annotColorPicker.addEventListener('input', e => {
    const annot = engine.annotations[engine.activeAnnotationIndex];
    if (annot) {
      const val = e.target.value;
      annot.color = val;
      annot.strokeColor = val;
      engine.render();
    }
  });
  annotColorPicker.addEventListener('change', () => history.recordChange());

  annotBgColorPicker.addEventListener('input', e => {
    const annot = engine.annotations[engine.activeAnnotationIndex];
    if (annot) {
      annot.fillColor = e.target.value;
      annot.hasBg = true;
      chkAnnotBg.checked = true;
      engine.render();
    }
  });
  annotBgColorPicker.addEventListener('change', () => history.recordChange());

  chkAnnotBg.addEventListener('change', e => {
    const annot = engine.annotations[engine.activeAnnotationIndex];
    if (annot) {
      annot.hasBg = e.target.checked;
      engine.render();
      history.recordChange();
    }
  });

  if (annotWidthInput) {
    annotWidthInput.addEventListener('input', e => {
      const annot = engine.annotations[engine.activeAnnotationIndex];
      if (annot) {
        annot.width = Math.max(20, parseInt(e.target.value, 10) || 20);
        engine.render();
      }
    });
    annotWidthInput.addEventListener('change', () => history.recordChange());
  }

  if (annotHeightInput) {
    annotHeightInput.addEventListener('input', e => {
      const annot = engine.annotations[engine.activeAnnotationIndex];
      if (annot) {
        annot.height = Math.max(20, parseInt(e.target.value, 10) || 20);
        engine.render();
      }
    });
    annotHeightInput.addEventListener('change', () => history.recordChange());
  }

  if (sliderAnnotStroke) {
    sliderAnnotStroke.addEventListener('input', e => {
      const annot = engine.annotations[engine.activeAnnotationIndex];
      if (annot) {
        const sw = parseInt(e.target.value, 10) || 0;
        annot.strokeWidth = sw;
        const valStroke = document.getElementById('val-annot-stroke');
        if (valStroke) valStroke.textContent = `${sw} px`;
        engine.render();
      }
    });
    sliderAnnotStroke.addEventListener('change', () => history.recordChange());
  }

  sliderAnnotOpacity.addEventListener('input', e => {
    const annot = engine.annotations[engine.activeAnnotationIndex];
    if (annot) {
      const val = parseInt(e.target.value, 10);
      document.getElementById('val-annot-opacity').textContent = `${val}%`;
      annot.opacity = val / 100;
      engine.render();
    }
  });

  document.getElementById('btn-annot-duplicate').addEventListener('click', () => {
    const annot = engine.annotations[engine.activeAnnotationIndex];
    if (!annot) return;
    const dup = new AnnotationItem({
      ...annot,
      id: `annot-${Date.now()}`,
      x: annot.x + 25,
      y: annot.y + 25,
      pinNumber: annot.type === 'pin' ? nextPinNumber++ : annot.pinNumber
    });
    engine.annotations.push(dup);
    engine.activeAnnotationIndex = engine.annotations.length - 1;
    syncAnnotationInspector();
    updateLayersList();
    engine.render();
    history.recordChange();
  });

  document.getElementById('btn-annot-delete').addEventListener('click', () => {
    if (engine.activeAnnotationIndex >= 0) {
      engine.annotations.splice(engine.activeAnnotationIndex, 1);
      engine.activeAnnotationIndex = -1;
      syncAnnotationInspector();
      updateLayersList();
      engine.render();
      history.recordChange();
    }
  });

  document.querySelectorAll('#brush-tool-pills .pill-btn').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#brush-tool-pills .pill-btn').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const mode = pill.getAttribute('data-brush');
      engine.activeBrushMode = mode;

      const hints = {
        'none': 'Select a brush mode and paint directly over the canvas photo.',
        'spot-heal': 'Click or paint over blemishes to blend and heal seamlessly.',
        'dodge': 'Brush over areas to lighten exposure.',
        'burn': 'Brush over areas to deepen shadows and darken.',
        'blur': 'Brush over spots to soften details.',
        'sponge': 'Brush to saturate or enhance vibrant tones.'
      };
      document.getElementById('brush-instruction-text').textContent = hints[mode] || '';
    });
  });

  const sliderBrushSize = document.getElementById('slider-brush-size');
  sliderBrushSize.addEventListener('input', e => {
    const val = parseInt(e.target.value, 10);
    document.getElementById('val-brush-size').textContent = `${val} px`;
    engine.brushSize = val;
  });

  const sliderBrushStrength = document.getElementById('slider-brush-strength');
  sliderBrushStrength.addEventListener('input', e => {
    const val = parseInt(e.target.value, 10);
    document.getElementById('val-brush-strength').textContent = `${val}%`;
    engine.brushStrength = val;
  });

  document.getElementById('btn-clear-brush-strokes').addEventListener('click', () => {
    const activePhoto = engine.getActivePhoto();
    if (!activePhoto) return;
    activePhoto.retouchStrokes = [];
    activePhoto.needsProcessing = true;
    engine.render();
    history.recordChange();
  });

  let isDragging = false;
  let dragTarget = null; // 'annotation' | 'annotation-resize' | 'split-handle' | 'crop-box' | 'brush' | 'photo-move' | 'photo-resize' | 'privacy-move' | 'privacy-resize'
  let dragOffset = { x: 0, y: 0 };
  let dragAnnotHandle = null;
  let dragAnnotInitial = null;
  let dragPrivacyHandle = null;
  let dragPrivacyInitial = null;
  let dragPhotoHandle = null;
  let dragPhotoInitial = null;

  function getCanvasCoords(e) {
    const rect = overlayCanvas.getBoundingClientRect();
    const scaleX = engine.width / rect.width;
    const scaleY = engine.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  function getAnnotationHandles(annot) {
    if (annot.type === 'arrow') {
      return {
        'arrow-start': { x: annot.x, y: annot.y },
        'arrow-end': { x: annot.endX, y: annot.endY }
      };
    }
    const bx = annot.x - annot.width / 2;
    const by = annot.y - annot.height / 2;
    const bw = annot.width;
    const bh = annot.height;
    return {
      'tl': { x: bx - 3, y: by - 3 },
      'tr': { x: bx + bw + 3, y: by - 3 },
      'bl': { x: bx - 3, y: by + bh + 3 },
      'br': { x: bx + bw + 3, y: by + bh + 3 },
      'tc': { x: bx + bw / 2, y: by - 3 },
      'bc': { x: bx + bw / 2, y: by + bh + 3 },
      'ml': { x: bx - 3, y: by + bh / 2 },
      'mr': { x: bx + bw + 3, y: by + bh / 2 }
    };
  }

  overlayCanvas.addEventListener('mousedown', e => {
    const { x, y } = getCanvasCoords(e);

    if (engine.activeBrushMode !== 'none') {
      const activePhoto = engine.getActivePhoto();
      if (activePhoto && activePhoto.slotBounds) {
        const slot = activePhoto.slotBounds;
        if (x >= slot.x && x <= slot.x + slot.width && y >= slot.y && y <= slot.y + slot.height) {
          isDragging = true;
          dragTarget = 'brush';
          const relX = ((x - slot.x) / slot.width) * activePhoto.processedCanvas.width;
          const relY = ((y - slot.y) / slot.height) * activePhoto.processedCanvas.height;
          engine.currentBrushStroke = {
            mode: engine.activeBrushMode,
            size: engine.brushSize,
            strength: engine.brushStrength,
            points: [{ x: relX, y: relY }]
          };
          activePhoto.retouchStrokes.push(engine.currentBrushStroke);
          activePhoto.needsProcessing = true;
          engine.render();
          return;
        }
      }
    }

    if (engine.activeAnnotationIndex >= 0 && engine.activeAnnotationIndex < engine.annotations.length) {
      const activeAnnot = engine.annotations[engine.activeAnnotationIndex];
      if (activeAnnot && activeAnnot.visible && !activeAnnot.locked) {
        const handles = getAnnotationHandles(activeAnnot);
        for (const [handleKey, pt] of Object.entries(handles)) {
          if (Math.abs(x - pt.x) <= 14 && Math.abs(y - pt.y) <= 14) {
            isDragging = true;
            dragTarget = 'annotation-resize';
            dragAnnotHandle = handleKey;
            dragAnnotInitial = {
              x: activeAnnot.x,
              y: activeAnnot.y,
              width: activeAnnot.width,
              height: activeAnnot.height,
              endX: activeAnnot.endX,
              endY: activeAnnot.endY,
              mouseX: x,
              mouseY: y
            };
            return;
          }
        }
      }
    }

    for (let i = engine.annotations.length - 1; i >= 0; i--) {
      const annot = engine.annotations[i];
      if (annot.containsPoint(x, y)) {
        engine.activeAnnotationIndex = i;
        isDragging = true;
        dragTarget = 'annotation';
        dragOffset = { x: x - annot.x, y: y - annot.y };
        syncAnnotationInspector();
        updateLayersList();
        engine.render();
        return;
      }
    }

    const activePhoto = engine.getActivePhoto();
    if (activePhoto && activePhoto.adjustments.privacyZones && activePhoto.slotBounds) {
      const slot = activePhoto.slotBounds;
      const zones = activePhoto.adjustments.privacyZones;

      if (engine.activePrivacyZoneIndex >= 0 && engine.activePrivacyZoneIndex < zones.length) {
        const zone = zones[engine.activePrivacyZoneIndex];
        const zx = zone.x <= 1 ? slot.x + zone.x * slot.width : zone.x;
        const zy = zone.y <= 1 ? slot.y + zone.y * slot.height : zone.y;
        const zw = zone.width <= 1 ? zone.width * slot.width : zone.width;
        const zh = zone.height <= 1 ? zone.height * slot.height : zone.height;
        const hw = 10;

        const handles = {
          'tl': { x: zx, y: zy },
          'tr': { x: zx + zw, y: zy },
          'bl': { x: zx, y: zy + zh },
          'br': { x: zx + zw, y: zy + zh }
        };

        for (const [handlePos, hPt] of Object.entries(handles)) {
          if (Math.abs(x - hPt.x) <= hw && Math.abs(y - hPt.y) <= hw) {
            isDragging = true;
            dragTarget = 'privacy-resize';
            dragPrivacyHandle = handlePos;
            dragPrivacyInitial = { x: zone.x, y: zone.y, width: zone.width, height: zone.height, mouseX: x, mouseY: y };
            return;
          }
        }
      }

      for (let i = zones.length - 1; i >= 0; i--) {
        const zone = zones[i];
        const zx = zone.x <= 1 ? slot.x + zone.x * slot.width : zone.x;
        const zy = zone.y <= 1 ? slot.y + zone.y * slot.height : zone.y;
        const zw = zone.width <= 1 ? zone.width * slot.width : zone.width;
        const zh = zone.height <= 1 ? zone.height * slot.height : zone.height;

        if (x >= zx && x <= zx + zw && y >= zy && y <= zy + zh) {
          engine.activePrivacyZoneIndex = i;
          isDragging = true;
          dragTarget = 'privacy-move';
          dragOffset = { x: x - zx, y: y - zy };
          renderPrivacyZonesList();
          engine.renderOverlays();
          return;
        }
      }
    }

    if (engine.layout === 'freeform') {
      const activeP = engine.getActivePhoto();
      if (activeP && activeP.slotBounds && !activeP.locked) {
        const b = activeP.slotBounds;
        const topMidX = b.x + b.width / 2;
        const rotKnobY = b.y - 26;

        if (Math.hypot(x - topMidX, y - rotKnobY) <= 16) {
          isDragging = true;
          dragTarget = 'photo-rotate';
          dragPhotoInitial = {
            centerX: b.x + b.width / 2,
            centerY: b.y + b.height / 2,
            startAngle: activeP.adjustments.rotation || 0,
            mouseX: x,
            mouseY: y
          };
          return;
        }

        const hw = 18;
        const handles = {
          'tl': { x: b.x, y: b.y },
          'tr': { x: b.x + b.width, y: b.y },
          'bl': { x: b.x, y: b.y + b.height },
          'br': { x: b.x + b.width, y: b.y + b.height },
          'tc': { x: topMidX, y: b.y },
          'bc': { x: topMidX, y: b.y + b.height },
          'ml': { x: b.x, y: b.y + b.height / 2 },
          'mr': { x: b.x + b.width, y: b.y + b.height / 2 }
        };

        for (const [pos, h] of Object.entries(handles)) {
          if (Math.abs(x - h.x) <= hw && Math.abs(y - h.y) <= hw) {
            isDragging = true;
            dragTarget = 'photo-resize';
            dragPhotoHandle = pos;
            dragPhotoInitial = {
              x: b.x,
              y: b.y,
              width: b.width,
              height: b.height,
              mouseX: x,
              mouseY: y,
              aspect: b.width / Math.max(1, b.height)
            };
            return;
          }
        }
      }
    }

    if (engine.isCropModeActive && engine.activeCropRect) {
      const cr = engine.activeCropRect;
      if (x >= cr.x && x <= cr.x + cr.width && y >= cr.y && y <= cr.y + cr.height) {
        isDragging = true;
        dragTarget = 'crop-box';
        dragOffset = { x: x - cr.x, y: y - cr.y };
        return;
      }
    }

    const slots = engine.calculateSlots();
    for (let i = engine.photos.length - 1; i >= 0; i--) {
      const photo = engine.photos[i];
      const slot = slots[i];
      if (slot && x >= slot.x && x <= slot.x + slot.width && y >= slot.y && y <= slot.y + slot.height) {
        engine.activePhotoIndex = i;
        engine.activeAnnotationIndex = -1;
        syncControlsToActivePhoto();
        syncAnnotationInspector();
        updateLayersList();
        updateFilmstripActive();

        if (engine.layout === 'freeform' && !photo.locked) {
          isDragging = true;
          dragTarget = 'photo-move';
          if (!photo.freeformBounds) {
            photo.freeformBounds = { ...slot };
          }
          dragOffset = { x: x - photo.freeformBounds.x, y: y - photo.freeformBounds.y };
        }

        engine.render();
        return;
      }
    }
  });

  overlayCanvas.addEventListener('mousemove', e => {
    const { x, y } = getCanvasCoords(e);
    if (engine.activeBrushMode !== 'none') {
      engine.brushCursorPos = { x, y };
      engine.renderOverlays();
      overlayCanvas.style.cursor = 'crosshair';
      return;
    }

    if (engine.activeAnnotationIndex >= 0 && engine.activeAnnotationIndex < engine.annotations.length) {
      const activeAnnot = engine.annotations[engine.activeAnnotationIndex];
      if (activeAnnot && activeAnnot.visible && !activeAnnot.locked) {
        const handles = getAnnotationHandles(activeAnnot);
        for (const [key, pt] of Object.entries(handles)) {
          if (Math.abs(x - pt.x) <= 14 && Math.abs(y - pt.y) <= 14) {
            if (key === 'tl' || key === 'br') overlayCanvas.style.cursor = 'nwse-resize';
            else if (key === 'tr' || key === 'bl') overlayCanvas.style.cursor = 'nesw-resize';
            else if (key === 'tc' || key === 'bc') overlayCanvas.style.cursor = 'ns-resize';
            else if (key === 'ml' || key === 'mr') overlayCanvas.style.cursor = 'ew-resize';
            else overlayCanvas.style.cursor = 'crosshair';
            return;
          }
        }
        if (activeAnnot.containsPoint(x, y)) {
          overlayCanvas.style.cursor = 'move';
          return;
        }
      }
    }

    const currentPhoto = engine.getActivePhoto();
    if (currentPhoto && currentPhoto.adjustments.privacyZones && currentPhoto.slotBounds) {
      const slot = currentPhoto.slotBounds;
      const zones = currentPhoto.adjustments.privacyZones;

      if (engine.activePrivacyZoneIndex >= 0 && engine.activePrivacyZoneIndex < zones.length) {
        const zone = zones[engine.activePrivacyZoneIndex];
        const zx = zone.x <= 1 ? slot.x + zone.x * slot.width : zone.x;
        const zy = zone.y <= 1 ? slot.y + zone.y * slot.height : zone.y;
        const zw = zone.width <= 1 ? zone.width * slot.width : zone.width;
        const zh = zone.height <= 1 ? zone.height * slot.height : zone.height;
        const hw = 10;

        if ((Math.abs(x - zx) <= hw && Math.abs(y - zy) <= hw) ||
            (Math.abs(x - (zx + zw)) <= hw && Math.abs(y - (zy + zh)) <= hw)) {
          overlayCanvas.style.cursor = 'nwse-resize';
          return;
        }
        if ((Math.abs(x - (zx + zw)) <= hw && Math.abs(y - zy) <= hw) ||
            (Math.abs(x - zx) <= hw && Math.abs(y - (zy + zh)) <= hw)) {
          overlayCanvas.style.cursor = 'nesw-resize';
          return;
        }
      }

      for (let i = zones.length - 1; i >= 0; i--) {
        const zone = zones[i];
        const zx = zone.x <= 1 ? slot.x + zone.x * slot.width : zone.x;
        const zy = zone.y <= 1 ? slot.y + zone.y * slot.height : zone.y;
        const zw = zone.width <= 1 ? zone.width * slot.width : zone.width;
        const zh = zone.height <= 1 ? zone.height * slot.height : zone.height;
        if (x >= zx && x <= zx + zw && y >= zy && y <= zy + zh) {
          overlayCanvas.style.cursor = 'move';
          return;
        }
      }
    }

    if (engine.layout === 'freeform') {
      const activeP = engine.getActivePhoto();
      if (activeP && activeP.slotBounds && !activeP.locked) {
        const b = activeP.slotBounds;
        const topMidX = b.x + b.width / 2;
        const rotKnobY = b.y - 26;
        const hw = 14;

        if (Math.hypot(x - topMidX, y - rotKnobY) <= 14) {
          overlayCanvas.style.cursor = 'alias';
          return;
        }
        if ((Math.abs(x - b.x) <= hw && Math.abs(y - b.y) <= hw) ||
            (Math.abs(x - (b.x + b.width)) <= hw && Math.abs(y - (b.y + b.height)) <= hw)) {
          overlayCanvas.style.cursor = 'nwse-resize';
          return;
        }
        if ((Math.abs(x - (b.x + b.width)) <= hw && Math.abs(y - b.y) <= hw) ||
            (Math.abs(x - b.x) <= hw && Math.abs(y - (b.y + b.height)) <= hw)) {
          overlayCanvas.style.cursor = 'nesw-resize';
          return;
        }
        if ((Math.abs(x - topMidX) <= hw && Math.abs(y - b.y) <= hw) ||
            (Math.abs(x - topMidX) <= hw && Math.abs(y - (b.y + b.height)) <= hw)) {
          overlayCanvas.style.cursor = 'ns-resize';
          return;
        }
        if ((Math.abs(x - b.x) <= hw && Math.abs(y - (b.y + b.height / 2)) <= hw) ||
            (Math.abs(x - (b.x + b.width)) <= hw && Math.abs(y - (b.y + b.height / 2)) <= hw)) {
          overlayCanvas.style.cursor = 'ew-resize';
          return;
        }
        if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
          overlayCanvas.style.cursor = 'move';
          return;
        }
      }

      const slots = engine.calculateSlots();
      for (let i = engine.photos.length - 1; i >= 0; i--) {
        const slot = slots[i];
        if (slot && x >= slot.x && x <= slot.x + slot.width && y >= slot.y && y <= slot.y + slot.height) {
          overlayCanvas.style.cursor = 'pointer';
          return;
        }
      }
    }

    overlayCanvas.style.cursor = 'default';
  });

  overlayCanvas.addEventListener('mouseleave', () => {
    if (engine.activeBrushMode !== 'none') {
      engine.brushCursorPos = null;
      engine.renderOverlays();
    }
    overlayCanvas.style.cursor = 'default';
  });

  window.addEventListener('mousemove', e => {
    if (!isDragging) return;
    const { x, y } = getCanvasCoords(e);

    if (dragTarget === 'brush' && engine.currentBrushStroke) {
      engine.brushCursorPos = { x, y };
      const activePhoto = engine.getActivePhoto();
      if (activePhoto && activePhoto.slotBounds) {
        const slot = activePhoto.slotBounds;
        const relX = ((x - slot.x) / slot.width) * activePhoto.processedCanvas.width;
        const relY = ((y - slot.y) / slot.height) * activePhoto.processedCanvas.height;

        const pts = engine.currentBrushStroke.points;
        const lastPt = pts[pts.length - 1];
        const dist = Math.sqrt((relX - lastPt.x) ** 2 + (relY - lastPt.y) ** 2);
        const minDist = Math.max(3, (engine.brushSize / 4));

        if (dist >= minDist) {
          pts.push({ x: relX, y: relY });
          activePhoto.needsProcessing = true;
          engine.render();
        }
      }
    } else if (dragTarget === 'privacy-move' && engine.activePrivacyZoneIndex >= 0) {
      const activePhoto = engine.getActivePhoto();
      if (activePhoto && activePhoto.adjustments.privacyZones && activePhoto.slotBounds) {
        const slot = activePhoto.slotBounds;
        const zone = activePhoto.adjustments.privacyZones[engine.activePrivacyZoneIndex];
        if (zone) {
          const newScreenX = x - dragOffset.x;
          const newScreenY = y - dragOffset.y;
          const normX = (newScreenX - slot.x) / slot.width;
          const normY = (newScreenY - slot.y) / slot.height;
          zone.x = Math.max(0, Math.min(1 - zone.width, normX));
          zone.y = Math.max(0, Math.min(1 - zone.height, normY));
          activePhoto.needsProcessing = true;
          engine.render();
        }
      }
    } else if (dragTarget === 'privacy-resize' && engine.activePrivacyZoneIndex >= 0) {
      const activePhoto = engine.getActivePhoto();
      if (activePhoto && activePhoto.adjustments.privacyZones && activePhoto.slotBounds) {
        const slot = activePhoto.slotBounds;
        const zone = activePhoto.adjustments.privacyZones[engine.activePrivacyZoneIndex];
        const init = dragPrivacyInitial;
        if (zone && init) {
          const deltaNormX = (x - init.mouseX) / slot.width;
          const deltaNormY = (y - init.mouseY) / slot.height;

          let newX = init.x;
          let newY = init.y;
          let newW = init.width;
          let newH = init.height;

          if (dragPrivacyHandle === 'br') {
            newW = Math.max(0.04, Math.min(1 - newX, init.width + deltaNormX));
            newH = Math.max(0.04, Math.min(1 - newY, init.height + deltaNormY));
          } else if (dragPrivacyHandle === 'bl') {
            const rightEdge = init.x + init.width;
            newX = Math.max(0, Math.min(rightEdge - 0.04, init.x + deltaNormX));
            newW = rightEdge - newX;
            newH = Math.max(0.04, Math.min(1 - newY, init.height + deltaNormY));
          } else if (dragPrivacyHandle === 'tr') {
            const bottomEdge = init.y + init.height;
            newY = Math.max(0, Math.min(bottomEdge - 0.04, init.y + deltaNormY));
            newH = bottomEdge - newY;
            newW = Math.max(0.04, Math.min(1 - newX, init.width + deltaNormX));
          } else if (dragPrivacyHandle === 'tl') {
            const rightEdge = init.x + init.width;
            const bottomEdge = init.y + init.height;
            newX = Math.max(0, Math.min(rightEdge - 0.04, init.x + deltaNormX));
            newY = Math.max(0, Math.min(bottomEdge - 0.04, init.y + deltaNormY));
            newW = rightEdge - newX;
            newH = bottomEdge - newY;
          }

          zone.x = newX;
          zone.y = newY;
          zone.width = newW;
          zone.height = newH;
          activePhoto.needsProcessing = true;
          engine.render();
        }
      }
    } else if (dragTarget === 'photo-move') {
      const activePhoto = engine.getActivePhoto();
      if (activePhoto && activePhoto.freeformBounds) {
        const newX = Math.round(x - dragOffset.x);
        const newY = Math.round(y - dragOffset.y);
        activePhoto.freeformBounds.x = newX;
        activePhoto.freeformBounds.y = newY;
        syncFreeformInspector();
        engine.render();
      }
    } else if (dragTarget === 'photo-rotate') {
      const activePhoto = engine.getActivePhoto();
      if (activePhoto && dragPhotoInitial) {
        const init = dragPhotoInitial;
        let deg = Math.atan2(y - init.centerY, x - init.centerX) * (180 / Math.PI) + 90;
        if (e.shiftKey) {
          deg = Math.round(deg / 15) * 15;
        } else {
          deg = Math.round(deg);
        }
        deg = (deg % 360 + 360) % 360;
        activePhoto.adjustments.rotation = deg;
        const sliderRot = document.getElementById('slider-rotation');
        if (sliderRot) sliderRot.value = deg;
        const valRot = document.getElementById('val-rotation');
        if (valRot) valRot.textContent = `${deg}°`;
        engine.render();
      }
    } else if (dragTarget === 'photo-resize') {
      const activePhoto = engine.getActivePhoto();
      if (activePhoto && dragPhotoInitial) {
        if (!activePhoto.freeformBounds) {
          activePhoto.freeformBounds = { ...dragPhotoInitial };
        }
        const init = dragPhotoInitial;
        const dx = x - init.mouseX;
        const dy = y - init.mouseY;
        const aspect = init.aspect || (init.width / Math.max(1, init.height));
        const keepAspect = (activePhoto.lockAspectRatio !== false) ^ e.shiftKey;

        let newX = init.x;
        let newY = init.y;
        let newW = init.width;
        let newH = init.height;

        if (dragPhotoHandle === 'br') {
          newW = Math.max(40, init.width + dx);
          newH = keepAspect ? Math.round(newW / aspect) : Math.max(40, init.height + dy);
        } else if (dragPhotoHandle === 'bl') {
          newW = Math.max(40, init.width - dx);
          newX = init.x + init.width - newW;
          newH = keepAspect ? Math.round(newW / aspect) : Math.max(40, init.height + dy);
        } else if (dragPhotoHandle === 'tr') {
          newW = Math.max(40, init.width + dx);
          newH = keepAspect ? Math.round(newW / aspect) : Math.max(40, init.height - dy);
          newY = init.y + init.height - newH;
        } else if (dragPhotoHandle === 'tl') {
          newW = Math.max(40, init.width - dx);
          newX = init.x + init.width - newW;
          newH = keepAspect ? Math.round(newW / aspect) : Math.max(40, init.height - dy);
          newY = init.y + init.height - newH;
        } else if (dragPhotoHandle === 'tc') {
          newH = Math.max(40, init.height - dy);
          newY = init.y + init.height - newH;
        } else if (dragPhotoHandle === 'bc') {
          newH = Math.max(40, init.height + dy);
        } else if (dragPhotoHandle === 'ml') {
          newW = Math.max(40, init.width - dx);
          newX = init.x + init.width - newW;
        } else if (dragPhotoHandle === 'mr') {
          newW = Math.max(40, init.width + dx);
        }

        activePhoto.freeformBounds.x = Math.round(newX);
        activePhoto.freeformBounds.y = Math.round(newY);
        activePhoto.freeformBounds.width = Math.round(newW);
        activePhoto.freeformBounds.height = Math.round(newH);
        syncFreeformInspector();
        engine.render();
      }
    } else if (dragTarget === 'annotation' && engine.activeAnnotationIndex >= 0) {
      const annot = engine.annotations[engine.activeAnnotationIndex];
      if (annot && !annot.locked) {
        const newX = Math.round(x - dragOffset.x);
        const newY = Math.round(y - dragOffset.y);
        const dx = newX - annot.x;
        const dy = newY - annot.y;
        annot.x = newX;
        annot.y = newY;
        if (annot.type === 'arrow') {
          annot.endX += dx;
          annot.endY += dy;
        }
        engine.render();
      }
    } else if (dragTarget === 'annotation-resize' && engine.activeAnnotationIndex >= 0) {
      const annot = engine.annotations[engine.activeAnnotationIndex];
      const init = dragAnnotInitial;
      if (annot && init && !annot.locked) {
        if (annot.type === 'arrow') {
          if (dragAnnotHandle === 'arrow-start') {
            annot.x = Math.round(x);
            annot.y = Math.round(y);
          } else if (dragAnnotHandle === 'arrow-end') {
            annot.endX = Math.round(x);
            annot.endY = Math.round(y);
          }
        } else {
          const dx = x - init.mouseX;
          const dy = y - init.mouseY;
          let left = init.x - init.width / 2;
          let top = init.y - init.height / 2;
          let right = init.x + init.width / 2;
          let bottom = init.y + init.height / 2;
          const minSize = 24;

          if (dragAnnotHandle === 'br') {
            right = Math.max(left + minSize, init.x + init.width / 2 + dx);
            bottom = Math.max(top + minSize, init.y + init.height / 2 + dy);
          } else if (dragAnnotHandle === 'bl') {
            left = Math.min(right - minSize, init.x - init.width / 2 + dx);
            bottom = Math.max(top + minSize, init.y + init.height / 2 + dy);
          } else if (dragAnnotHandle === 'tr') {
            right = Math.max(left + minSize, init.x + init.width / 2 + dx);
            top = Math.min(bottom - minSize, init.y - init.height / 2 + dy);
          } else if (dragAnnotHandle === 'tl') {
            left = Math.min(right - minSize, init.x - init.width / 2 + dx);
            top = Math.min(bottom - minSize, init.y - init.height / 2 + dy);
          } else if (dragAnnotHandle === 'tc') {
            top = Math.min(bottom - minSize, init.y - init.height / 2 + dy);
          } else if (dragAnnotHandle === 'bc') {
            bottom = Math.max(top + minSize, init.y + init.height / 2 + dy);
          } else if (dragAnnotHandle === 'ml') {
            left = Math.min(right - minSize, init.x - init.width / 2 + dx);
          } else if (dragAnnotHandle === 'mr') {
            right = Math.max(left + minSize, init.x + init.width / 2 + dx);
          }

          annot.width = Math.round(Math.max(minSize, right - left));
          annot.height = Math.round(Math.max(minSize, bottom - top));
          annot.x = Math.round(left + annot.width / 2);
          annot.y = Math.round(top + annot.height / 2);

          if (annot.type === 'circle' && e.shiftKey) {
            const maxDim = Math.max(annot.width, annot.height);
            annot.width = maxDim;
            annot.height = maxDim;
          }
        }
        syncAnnotationInspector();
        engine.render();
      }
    } else if (dragTarget === 'crop-box' && engine.activeCropRect) {
      engine.activeCropRect.x = Math.max(0, Math.min(engine.width - engine.activeCropRect.width, Math.round(x - dragOffset.x)));
      engine.activeCropRect.y = Math.max(0, Math.min(engine.height - engine.activeCropRect.height, Math.round(y - dragOffset.y)));
      engine.render();
    }
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      dragTarget = null;
      dragAnnotHandle = null;
      dragAnnotInitial = null;
      dragPrivacyHandle = null;
      dragPrivacyInitial = null;
      dragPhotoHandle = null;
      dragPhotoInitial = null;
      engine.currentBrushStroke = null;
      syncFreeformInspector();
      history.recordChange();
    }
  });

  overlayCanvas.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const simulatedEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY,
        bubbles: true
      });
      overlayCanvas.dispatchEvent(simulatedEvent);
      e.preventDefault();
    }
  }, { passive: false });

  window.addEventListener('touchmove', e => {
    if (isDragging && e.touches.length === 1) {
      const touch = e.touches[0];
      const simulatedEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY,
        bubbles: true
      });
      window.dispatchEvent(simulatedEvent);
      e.preventDefault();
    }
  }, { passive: false });

  window.addEventListener('touchend', () => {
    if (isDragging) {
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    }
  });

  window.addEventListener('keydown', e => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    if (engine.layout === 'freeform') {
      const activePhoto = engine.getActivePhoto();
      if (activePhoto && activePhoto.freeformBounds && !activePhoto.locked) {
        const step = e.shiftKey ? 10 : 1;
        let moved = false;
        if (e.key === 'ArrowLeft') { activePhoto.freeformBounds.x -= step; moved = true; }
        else if (e.key === 'ArrowRight') { activePhoto.freeformBounds.x += step; moved = true; }
        else if (e.key === 'ArrowUp') { activePhoto.freeformBounds.y -= step; moved = true; }
        else if (e.key === 'ArrowDown') { activePhoto.freeformBounds.y += step; moved = true; }
        if (moved) {
          e.preventDefault();
          syncFreeformInspector();
          engine.render();
          history.recordChange();
        }
      }
    }
  });

  let isDraggingSplit = false;
  splitSliderLine.addEventListener('mousedown', e => {
    isDraggingSplit = true;
    e.stopPropagation();
  });

  window.addEventListener('mousemove', e => {
    if (!isDraggingSplit) return;
    const activePhoto = engine.getActivePhoto();
    if (!activePhoto || !activePhoto.slotBounds) return;
    const slot = activePhoto.slotBounds;
    const { x } = getCanvasCoords(e);
    const ratio = Math.max(0.05, Math.min(0.95, (x - slot.x) / slot.width));
    engine.splitRatio = ratio;
    updateSplitHandlePosition();
    engine.render();
  });

  window.addEventListener('mouseup', () => {
    if (isDraggingSplit) isDraggingSplit = false;
  });

  const layersListContainer = document.getElementById('layers-list');
  const sliderLayerOpacity = document.getElementById('slider-layer-opacity');

  sliderLayerOpacity.addEventListener('input', e => {
    const val = parseInt(e.target.value, 10);
    document.getElementById('val-layer-opacity').textContent = `${val}%`;

    if (engine.activeAnnotationIndex >= 0) {
      const annot = engine.annotations[engine.activeAnnotationIndex];
      if (annot) {
        annot.opacity = val / 100;
        engine.render();
      }
    } else {
      const photo = engine.getActivePhoto();
      if (photo) {
        photo.opacity = val / 100;
        engine.render();
      }
    }
  });

  function updateLayersList() {
    layersListContainer.innerHTML = '';

    engine.photos.forEach((photo, idx) => {
      const item = document.createElement('div');
      const isSelected = engine.activePhotoIndex === idx && engine.activeAnnotationIndex === -1;
      item.className = `layer-item ${isSelected ? 'active' : ''}`;

      item.innerHTML = `
        <div class="layer-item-left">
          <i data-lucide="image" style="width:14px;height:14px;"></i>
          <span>${photo.meta.title}</span>
        </div>
        <div class="layer-actions">
          <button class="layer-icon-btn btn-vis" title="Toggle Visibility">
            <i data-lucide="${photo.visible ? 'eye' : 'eye-off'}" style="width:12px;height:12px;"></i>
          </button>
          <button class="layer-icon-btn btn-lock" title="Lock">
            <i data-lucide="${photo.locked ? 'lock' : 'unlock'}" style="width:12px;height:12px;"></i>
          </button>
        </div>
      `;

      item.addEventListener('click', e => {
        if (e.target.closest('button')) return;
        engine.activePhotoIndex = idx;
        engine.activeAnnotationIndex = -1;
        syncControlsToActivePhoto();
        updateLayersList();
        updateFilmstripActive();
        engine.render();
      });

      item.querySelector('.btn-vis').addEventListener('click', () => {
        photo.visible = !photo.visible;
        updateLayersList();
        engine.render();
        history.recordChange();
      });

      item.querySelector('.btn-lock').addEventListener('click', () => {
        photo.locked = !photo.locked;
        updateLayersList();
        history.recordChange();
      });

      layersListContainer.appendChild(item);
    });

    engine.annotations.forEach((annot, idx) => {
      const item = document.createElement('div');
      const isSelected = engine.activeAnnotationIndex === idx;
      item.className = `layer-item ${isSelected ? 'active' : ''}`;

      item.innerHTML = `
        <div class="layer-item-left">
          <i data-lucide="type" style="width:14px;height:14px;"></i>
          <span>${annot.type.toUpperCase()}: ${annot.text.slice(0, 16)}</span>
        </div>
        <div class="layer-actions">
          <button class="layer-icon-btn btn-vis" title="Toggle Visibility">
            <i data-lucide="${annot.visible ? 'eye' : 'eye-off'}" style="width:12px;height:12px;"></i>
          </button>
        </div>
      `;

      item.addEventListener('click', e => {
        if (e.target.closest('button')) return;
        engine.activeAnnotationIndex = idx;
        syncAnnotationInspector();
        updateLayersList();
        engine.render();
      });

      item.querySelector('.btn-vis').addEventListener('click', () => {
        annot.visible = !annot.visible;
        updateLayersList();
        engine.render();
        history.recordChange();
      });

      layersListContainer.appendChild(item);
    });

    refreshIcons();
  }

  document.getElementById('btn-layer-move-up').addEventListener('click', () => {
    if (engine.activeAnnotationIndex >= 0 && engine.activeAnnotationIndex < engine.annotations.length - 1) {
      const temp = engine.annotations[engine.activeAnnotationIndex];
      engine.annotations[engine.activeAnnotationIndex] = engine.annotations[engine.activeAnnotationIndex + 1];
      engine.annotations[engine.activeAnnotationIndex + 1] = temp;
      engine.activeAnnotationIndex++;
      updateLayersList();
      engine.render();
      history.recordChange();
    } else if (engine.activeAnnotationIndex === -1 && engine.activePhotoIndex >= 0 && engine.activePhotoIndex < engine.photos.length - 1) {
      engine.movePhotoLayer(engine.activePhotoIndex, engine.activePhotoIndex + 1);
      updateLayersList();
      updateFilmstripActive();
      history.recordChange();
    }
  });

  document.getElementById('btn-layer-move-down').addEventListener('click', () => {
    if (engine.activeAnnotationIndex > 0) {
      const temp = engine.annotations[engine.activeAnnotationIndex];
      engine.annotations[engine.activeAnnotationIndex] = engine.annotations[engine.activeAnnotationIndex - 1];
      engine.annotations[engine.activeAnnotationIndex - 1] = temp;
      engine.activeAnnotationIndex--;
      updateLayersList();
      engine.render();
      history.recordChange();
    } else if (engine.activeAnnotationIndex === -1 && engine.activePhotoIndex > 0) {
      engine.movePhotoLayer(engine.activePhotoIndex, engine.activePhotoIndex - 1);
      updateLayersList();
      updateFilmstripActive();
      history.recordChange();
    }
  });

  document.getElementById('btn-layer-duplicate').addEventListener('click', () => {
    if (engine.activeAnnotationIndex >= 0) {
      document.getElementById('btn-annot-duplicate').click();
    }
  });

  document.getElementById('btn-layer-delete').addEventListener('click', () => {
    if (engine.activeAnnotationIndex >= 0) {
      document.getElementById('btn-annot-delete').click();
    } else if (engine.photos.length > 1) {
      engine.removePhoto(engine.activePhotoIndex);
      updateFilmstrip();
      updateLayersList();
      syncControlsToActivePhoto();
      history.recordChange();
    }
  });

  const filmstripContainer = document.getElementById('filmstrip-items');
  const photoCountBadge = document.getElementById('photo-count-badge');

  function updateFilmstrip() {
    filmstripContainer.innerHTML = '';
    photoCountBadge.textContent = String(engine.photos.length);

    engine.photos.forEach((photo, idx) => {
      const item = document.createElement('div');
      item.className = `filmstrip-item ${idx === engine.activePhotoIndex ? 'active' : ''}`;
      item.innerHTML = `
        <img src="${photo.img.src}" alt="${photo.meta.title}" />
        <span class="photo-badge">#${idx + 1}</span>
        <button class="photo-remove-btn" title="Remove Photo">&times;</button>
      `;

      item.addEventListener('click', e => {
        if (e.target.closest('.photo-remove-btn')) return;
        engine.activePhotoIndex = idx;
        engine.activeAnnotationIndex = -1;
        syncControlsToActivePhoto();
        updateFilmstripActive();
        updateLayersList();
        engine.render();
      });

      item.querySelector('.photo-remove-btn').addEventListener('click', e => {
        e.stopPropagation();
        engine.removePhoto(idx);
        updateFilmstrip();
        updateLayersList();
        syncControlsToActivePhoto();
        history.recordChange();
      });

      filmstripContainer.appendChild(item);
    });

    updateActiveImageBadge();
  }

  function updateActiveImageBadge() {
    const badge = document.getElementById('active-image-name-badge');
    if (!badge) return;
    const activePhoto = engine.getActivePhoto();
    if (!activePhoto) {
      badge.textContent = 'No photo selected';
      badge.title = '';
      return;
    }
    const idx = engine.activePhotoIndex + 1;
    let title = (activePhoto.meta?.title || `Photo #${idx}`).replace(/\.(jpe?g|png|webp|gif|svg)$/i, '');
    badge.textContent = `#${idx}: ${title}`;
    badge.title = `${title} (Photo #${idx})`;
  }

  function updateFilmstripActive() {
    const items = filmstripContainer.querySelectorAll('.filmstrip-item');
    items.forEach((item, idx) => {
      item.classList.toggle('active', idx === engine.activePhotoIndex);
    });
    updateActiveImageBadge();
  }

  function syncControlsToActivePhoto() {
    const photo = engine.getActivePhoto();
    if (!photo) return;
    const adj = photo.adjustments;

    lightSliders.forEach(({ id, prop, displayId, format }) => {
      const slider = document.getElementById(id);
      const display = document.getElementById(displayId);
      if (slider) {
        slider.value = adj[prop] !== undefined ? adj[prop] : DEFAULT_ADJUSTMENTS[prop];
        if (display) display.textContent = format ? format(slider.value) : String(slider.value);
      }
    });

    gradingSliders.forEach(({ id, prop, displayId, format }) => {
      const slider = document.getElementById(id);
      const display = document.getElementById(displayId);
      if (slider) {
        slider.value = adj[prop] !== undefined ? adj[prop] : DEFAULT_ADJUSTMENTS[prop];
        if (display) display.textContent = format ? format(slider.value) : String(slider.value);
      }
    });

    detailSliders.forEach(({ id, prop, displayId, format }) => {
      const slider = document.getElementById(id);
      const display = document.getElementById(displayId);
      if (slider) {
        slider.value = adj[prop] !== undefined ? adj[prop] : 0;
        if (display) display.textContent = format ? format(slider.value) : String(slider.value);
      }
    });

    chkCutoutEnable.checked = !!adj.cutoutEnabled;
    chkCutoutInvert.checked = !!adj.cutoutInvert;
    cutoutColorInput.value = adj.cutoutColor || '#FFFFFF';
    cutoutTargetSwatch.style.background = adj.cutoutColor || '#FFFFFF';
    sliderCutoutTol.value = adj.cutoutTolerance || 35;
    document.getElementById('val-cutout-tolerance').textContent = String(sliderCutoutTol.value);

    renderFilterCards();

    renderPrivacyZonesList();

    document.querySelectorAll('#toning-style-pills .pill-btn').forEach(pill => {
      pill.classList.toggle('active', pill.getAttribute('data-tone') === (adj.toneStyle || 'none'));
    });

    syncFreeformInspector();
  }

  const localFileInput = document.getElementById('local-file-input');
  document.getElementById('btn-upload-file').addEventListener('click', () => localFileInput.click());
  document.getElementById('btn-add-photos').addEventListener('click', () => localFileInput.click());

  localFileInput.addEventListener('change', e => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
          const photo = new CollagePhoto(img, {
            title: file.name.replace(/\.[^/.]+$/, ''),
            author: 'Local Contributor',
            license: 'Own Work / CC BY-SA 4.0'
          });
          engine.addPhoto(photo);
          updateFilmstrip();
          updateLayersList();
          syncControlsToActivePhoto();
          history.recordChange();
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  });

  function loadRemoteImage(photoMeta) {
    return new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const photo = new CollagePhoto(img, photoMeta);
        if (engine.layout === 'freeform') {
          const p = engine.padding;
          const innerW = engine.width - p * 2;
          const innerH = engine.height - p * 2;
          const aspect = (img.naturalWidth && img.naturalHeight) ? (img.naturalWidth / img.naturalHeight) : (4 / 3);
          const fw = Math.min(innerW * 0.45, 460);
          const fh = Math.round(fw / Math.max(0.2, aspect));
          const idx = engine.photos.length;
          const offsetX = p + (idx * 50) % Math.max(20, innerW - fw);
          const offsetY = p + (idx * 40) % Math.max(20, innerH - fh);
          photo.freeformBounds = { x: Math.round(offsetX), y: Math.round(offsetY), width: Math.round(fw), height: Math.round(fh) };
        }
        engine.addPhoto(photo);
        updateFilmstrip();
        updateLayersList();
        syncControlsToActivePhoto();
        history.recordChange();
        updateCommonsModalFooter();
        resolve(photo);
      };
      img.onerror = () => {
        const fallbackCanvas = document.createElement('canvas');
        fallbackCanvas.width = 800;
        fallbackCanvas.height = 600;
        const fCtx = fallbackCanvas.getContext('2d');
        fCtx.fillStyle = '#E8E5F8';
        fCtx.fillRect(0, 0, 800, 600);
        fCtx.fillStyle = '#7346A8';
        fCtx.font = 'bold 28px sans-serif';
        fCtx.textAlign = 'center';
        fCtx.fillText(photoMeta.title, 400, 300);
        const fImg = new Image();
        fImg.onload = () => {
          const photo = new CollagePhoto(fImg, photoMeta);
          if (engine.layout === 'freeform') {
            const p = engine.padding;
            photo.freeformBounds = { x: p + 30, y: p + 30, width: 440, height: 330 };
          }
          engine.addPhoto(photo);
          updateFilmstrip();
          updateLayersList();
          syncControlsToActivePhoto();
          history.recordChange();
          updateCommonsModalFooter();
          resolve(photo);
        };
        fImg.src = fallbackCanvas.toDataURL();
      };
      img.src = photoMeta.imageUrl;
    });
  }

  document.getElementById('btn-clear-all-photos')?.addEventListener('click', () => {
    if (engine.photos.length === 0) return;
    if (confirm('Are you sure you want to remove all photos from the collage canvas?')) {
      engine.photos = [];
      engine.activePhotoIndex = -1;
      updateFilmstrip();
      updateLayersList();
      updateActiveImageBadge();
      syncControlsToActivePhoto();
      engine.render();
      history.recordChange();
    }
  });

  const floatingControls = document.getElementById('floating-viewport-controls');
  const btnToggleFloating = document.getElementById('btn-toggle-floating-controls');
  if (btnToggleFloating && floatingControls) {
    btnToggleFloating.addEventListener('click', () => {
      const isMin = floatingControls.classList.toggle('minimized');
      btnToggleFloating.title = isMin ? 'Expand controls bar' : 'Minimize controls bar';
      btnToggleFloating.innerHTML = isMin 
        ? '<i data-lucide="chevron-up" style="width:14px;height:14px;"></i>' 
        : '<i data-lucide="chevron-down" style="width:14px;height:14px;"></i>';
      refreshIcons();
    });
  }

  const modalCommons = document.getElementById('modal-commons-search');
  const commonsResultsGrid = document.getElementById('commons-results-grid');
  const commonsQueryInput = document.getElementById('commons-query-input');
  const commonsStatusBar = document.getElementById('commons-status-text');
  const commonsCountBadge = document.getElementById('commons-count-badge');
  const commonsLoadMoreWrap = document.getElementById('commons-load-more-wrap');
  const btnCommonsLoadMore = document.getElementById('btn-commons-load-more');

  let commonsCurrentQuery = '';
  let commonsNextOffset = null;
  let isCommonsSearching = false;

  function updateCommonsModalFooter() {
    const statsEl = document.getElementById('commons-modal-footer-stats');
    if (statsEl) {
      statsEl.textContent = `Collage has ${engine.photos.length} photo${engine.photos.length === 1 ? '' : 's'}`;
    }
  }

  document.getElementById('btn-commons-search').addEventListener('click', () => {
    modalCommons.classList.remove('hidden');
    updateCommonsModalFooter();
    if (!commonsQueryInput.value.trim() && commonsResultsGrid.children.length === 0) {
      renderCommonsSearchPrompt();
    }
  });

  function createCommonsCard(item) {
    const card = document.createElement('div');
    card.className = 'commons-result-card';
    card.innerHTML = `
      <div class="commons-card-img-wrap">
        <img src="${item.imageUrl}" alt="${item.title}" loading="lazy" />
        ${item.sourceUrl ? `
          <a href="${item.sourceUrl}" target="_blank" rel="noopener noreferrer" class="commons-external-link" title="Open source on Wikimedia Commons" onclick="event.stopPropagation();">
            <i data-lucide="external-link" style="width:12px;height:12px;"></i>
          </a>` : ''}
      </div>
      <div class="commons-card-info">
        <span class="commons-card-title" title="${item.title}">${item.title}</span>
        <span class="commons-card-author" title="${item.author}">By ${item.author}</span>
        <div class="commons-card-footer">
          <span class="commons-card-license" title="${item.license}">${item.license}</span>
          <button class="btn-add-commons-photo" title="Add this photo to collage">
            <i data-lucide="plus" style="width:11px;height:11px;"></i>
            <span>Add</span>
          </button>
        </div>
      </div>
    `;

    const addBtn = card.querySelector('.btn-add-commons-photo');
    const onAdd = async () => {
      if (addBtn.classList.contains('added')) return;
      addBtn.innerHTML = '<span>Adding...</span>';
      await loadRemoteImage(item);
      addBtn.classList.add('added');
      addBtn.innerHTML = '<i data-lucide="check" style="width:11px;height:11px;"></i><span>Added</span>';
      refreshIcons();
    };

    addBtn.addEventListener('click', e => {
      e.stopPropagation();
      onAdd();
    });

    card.addEventListener('click', () => {
      onAdd();
    });

    return card;
  }

  function renderCommonsSearchPrompt() {
    commonsResultsGrid.innerHTML = `
      <div class="empty-state-text" style="grid-column: 1 / -1; padding: 36px 16px; text-align: center; color: var(--text-muted);">
        <i data-lucide="search" style="width:32px;height:32px;color:var(--pastel-lavender-accent);margin-bottom:10px;display:inline-block;"></i>
        <h4 style="font-size:15px;font-weight:700;color:var(--text-main);margin-bottom:6px;">Search Millions of Wikimedia Commons Photos</h4>
        <p style="font-size:12.5px;max-width:440px;margin:0 auto 16px auto;">Type a search keyword above or click any inspiration topic below to find and add freely usable photos into your collage.</p>
      </div>
    `;
    commonsStatusBar.textContent = 'Type a query above or click a topic below to search Wikimedia Commons';
    commonsCountBadge.textContent = 'Ready';
    commonsLoadMoreWrap.classList.add('hidden');
    refreshIcons();
  }

  async function performCommonsSearch(query, isLoadMore = false) {
    if (!query || !query.trim() || isCommonsSearching) return;
    isCommonsSearching = true;

    if (!isLoadMore) {
      commonsCurrentQuery = query.trim();
      commonsNextOffset = null;
      commonsResultsGrid.innerHTML = '<div class="empty-state-text" style="grid-column: 1 / -1; padding: 40px 0; text-align: center; color: var(--text-muted);"><i data-lucide="loader-2" class="spin" style="width:24px;height:24px;display:inline-block;margin-bottom:8px;"></i><div>Searching Wikimedia Commons for "<strong>' + commonsCurrentQuery + '</strong>"...</div></div>';
      commonsStatusBar.textContent = `Connecting to Wikimedia Commons API...`;
      commonsCountBadge.textContent = 'Searching';
      commonsLoadMoreWrap.classList.add('hidden');
      refreshIcons();
    } else {
      btnCommonsLoadMore.innerHTML = '<i data-lucide="loader-2" class="spin" style="width:12px;height:12px;"></i> Loading...';
    }

    const { results, nextOffset, error } = await searchWikimediaCommons(commonsCurrentQuery, isLoadMore ? (commonsNextOffset || 0) : 0);
    isCommonsSearching = false;

    if (!isLoadMore) {
      commonsResultsGrid.innerHTML = '';
    }

    btnCommonsLoadMore.innerHTML = '<i data-lucide="chevrons-down" style="width:12px;height:12px;"></i> <span>Load More Wikimedia Photos</span>';

    if (results.length === 0 && !isLoadMore) {
      commonsResultsGrid.innerHTML = `
        <div class="empty-state-text" style="grid-column: 1 / -1; padding: 40px 0; text-align: center;">
          <p>No images found matching "<strong>${commonsCurrentQuery}</strong>".</p>
          <p class="text-sm text-muted mt-1">Try broader terms like "Impressionism", "Orchid", "Gothic cathedral", or "Space".</p>
        </div>
      `;
      commonsStatusBar.textContent = `0 results found for "${commonsCurrentQuery}"`;
      commonsCountBadge.textContent = '0 results';
      return;
    }

    results.forEach(res => {
      const card = createCommonsCard(res);
      commonsResultsGrid.appendChild(card);
    });

    commonsNextOffset = nextOffset;
    const totalCount = commonsResultsGrid.children.length;
    commonsStatusBar.textContent = `Found photos for "${commonsCurrentQuery}" (click to add to collage):`;
    commonsCountBadge.textContent = `${totalCount} photos`;

    if (nextOffset) {
      commonsLoadMoreWrap.classList.remove('hidden');
    } else {
      commonsLoadMoreWrap.classList.add('hidden');
    }

    refreshIcons();
  }

  document.getElementById('btn-run-commons-search').addEventListener('click', () => {
    performCommonsSearch(commonsQueryInput.value);
  });

  commonsQueryInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') performCommonsSearch(commonsQueryInput.value);
  });

  btnCommonsLoadMore.addEventListener('click', () => {
    if (commonsNextOffset) {
      performCommonsSearch(commonsCurrentQuery, true);
    }
  });

  document.querySelectorAll('.curated-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const q = pill.getAttribute('data-query');
      commonsQueryInput.value = q;
      performCommonsSearch(q);
    });
  });

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-close-modal');
      const target = document.getElementById(`modal-${modalId}`);
      if (target) target.classList.add('hidden');
    });
  });

  const modalExport = document.getElementById('modal-export');
  const exportPreviewImg = document.getElementById('export-preview-img');
  const exportFileFeedback = document.getElementById('export-file-feedback');
  const exportAttributionText = document.getElementById('export-attribution-text');

  let currentExportFormat = 'image/png';
  let currentExportScale = 1;
  let currentExportQuality = 0.92;

  document.getElementById('btn-export-studio').addEventListener('click', async () => {
    modalExport.classList.remove('hidden');
    await updateExportModalPreview();
  });

  async function updateExportModalPreview() {
    const dataUrl = exportEngine.getExportDataUrl(1, currentExportFormat, currentExportQuality);
    exportPreviewImg.src = dataUrl;

    const estimatedBytes = await exportEngine.estimateFileSize(currentExportScale, currentExportFormat, currentExportQuality);
    const sizeMb = (estimatedBytes / (1024 * 1024)).toFixed(2);
    const targetW = engine.width * currentExportScale;
    const targetH = engine.height * currentExportScale;

    exportFileFeedback.innerHTML = `
      <span>Estimated Size: ~${sizeMb} MB</span>
      <span>Dimensions: ${targetW} × ${targetH} px</span>
    `;

    exportAttributionText.value = exportEngine.generateWikiTextManifest();
  }

  document.querySelectorAll('#export-format-pills .pill-btn').forEach(pill => {
    pill.addEventListener('click', async () => {
      document.querySelectorAll('#export-format-pills .pill-btn').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentExportFormat = pill.getAttribute('data-format');
      await updateExportModalPreview();
    });
  });

  document.querySelectorAll('#export-scale-pills .pill-btn').forEach(pill => {
    pill.addEventListener('click', async () => {
      document.querySelectorAll('#export-scale-pills .pill-btn').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentExportScale = parseInt(pill.getAttribute('data-scale'), 10) || 1;
      await updateExportModalPreview();
    });
  });

  const sliderExportQuality = document.getElementById('slider-export-quality');
  sliderExportQuality.addEventListener('input', async e => {
    const val = parseInt(e.target.value, 10);
    document.getElementById('val-export-quality').textContent = `${val}%`;
    currentExportQuality = val / 100;
    await updateExportModalPreview();
  });

  document.getElementById('btn-copy-wikitext').addEventListener('click', () => {
    const text = exportEngine.generateWikiTextManifest();
    exportAttributionText.value = text;
    navigator.clipboard.writeText(text);
    alert('Wikimedia Commons WikiText markup copied to clipboard!');
  });

  document.getElementById('btn-copy-markdown').addEventListener('click', () => {
    const text = exportEngine.generateMarkdownManifest();
    exportAttributionText.value = text;
    navigator.clipboard.writeText(text);
    alert('Markdown attribution manifest copied to clipboard!');
  });

  document.getElementById('btn-download-image').addEventListener('click', async () => {
    const btn = document.getElementById('btn-download-image');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="spin"></i> Preparing...`;
    if (window.lucide) window.lucide.createIcons();

    const ext = currentExportFormat === 'image/jpeg' ? 'jpg' : currentExportFormat === 'image/webp' ? 'webp' : 'png';
    const filename = `commons-collage-${Date.now()}.${ext}`;
    const mimeType = currentExportFormat;

    try {
      if ('showSaveFilePicker' in window) {
        let handle;
        try {
          handle = await window.showSaveFilePicker({
            suggestedName: filename,
            types: [{
              description: `${ext.toUpperCase()} Image`,
              accept: { [mimeType]: [`.${ext}`] }
            }]
          });
        } catch (pickerErr) {
          if (pickerErr.name === 'AbortError') return;
          throw pickerErr;
        }

        const blob = await exportEngine.getExportBlob(currentExportScale, currentExportFormat, currentExportQuality);
        if (!blob) throw new Error('Could not generate image');

        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        const blob = await exportEngine.getExportBlob(currentExportScale, currentExportFormat, currentExportQuality);
        if (!blob) throw new Error('Could not generate image blob');

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.download = filename;
        a.href = url;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
          if (a.parentNode) document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 60000);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Download error:', err);
        try {
          const blob = await exportEngine.getExportBlob(currentExportScale, currentExportFormat, currentExportQuality);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.download = filename;
          a.href = url;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            if (a.parentNode) document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 60000);
        } catch (fallbackErr) {
          alert('Failed to download image: ' + fallbackErr.message);
        }
      }
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
      if (window.lucide) window.lucide.createIcons();
    }
  });

  const modalProject = document.getElementById('modal-project');
  document.getElementById('btn-project-state').addEventListener('click', () => {
    modalProject.classList.remove('hidden');
  });

  document.getElementById('btn-save-project-file').addEventListener('click', () => {
    const jsonStr = exportEngine.exportProjectJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `project-${Date.now()}.wikicollage.json`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
    modalProject.classList.add('hidden');
  });

  document.getElementById('project-file-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const project = JSON.parse(ev.target.result);
        if (project.canvas) {
          engine.setDimensions(project.canvas.width, project.canvas.height);
          engine.layout = project.canvas.layout || 'single';
          engine.spacing = project.canvas.spacing || 16;
          engine.padding = project.canvas.padding || 20;
          engine.cornerRadius = project.canvas.cornerRadius || 8;
          engine.bgColor = project.canvas.bgColor || '#F8F9FD';
          engine.transparentBg = !!project.canvas.transparentBg;
        }

        engine.photos = [];
        if (project.photos) {
          project.photos.forEach(pData => {
            const img = new Image();
            img.onload = () => {
              const photo = new CollagePhoto(img, pData.meta);
              photo.adjustments = pData.adjustments || DEFAULT_ADJUSTMENTS;
              photo.opacity = pData.opacity !== undefined ? pData.opacity : 1.0;
              photo.visible = pData.visible !== undefined ? pData.visible : true;
              photo.retouchStrokes = pData.retouchStrokes || [];
              photo.freeformBounds = pData.freeformBounds ? { ...pData.freeformBounds } : null;
              engine.photos.push(photo);
              updateFilmstrip();
              updateLayersList();
              syncControlsToActivePhoto();
              engine.render();
            };
            img.src = pData.imageSrc;
          });
        }

        engine.annotations = [];
        if (project.annotations) {
          project.annotations.forEach(aData => {
            const annot = new AnnotationItem(aData);
            engine.annotations.push(annot);
          });
        }

        modalProject.classList.add('hidden');
        history.recordChange();
      } catch (err) {
        alert('Failed to parse project file: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      if (e.shiftKey) history.redo();
      else history.undo();
      e.preventDefault();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      history.redo();
      e.preventDefault();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (engine.activeAnnotationIndex >= 0) {
        document.getElementById('btn-annot-delete').click();
        e.preventDefault();
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      document.getElementById('btn-quick-copy-adj').click();
      e.preventDefault();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
      document.getElementById('btn-quick-paste-adj').click();
      e.preventDefault();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
      if (engine.activeAnnotationIndex >= 0) {
        document.getElementById('btn-annot-duplicate').click();
        e.preventDefault();
      }
    }
  });

  refreshIcons();
  fitZoomToScreen();
  renderFilterCards();
  syncControlsToActivePhoto();
  updateLayersList();
  updateActiveImageBadge();
  engine.render();

  let resizeDebounceTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeDebounceTimer);
    resizeDebounceTimer = setTimeout(() => {
      fitZoomToScreen();
    }, 120);
  });
});
