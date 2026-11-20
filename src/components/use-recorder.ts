import { useEffect, useRef } from "react";
import { fetchPage, saveRecording } from "@/lib/actions";
import { effectiveGear, type GearSettings } from "@/lib/gear";
import { beginPreview, beginScreenRecord, beginStudioRecord, stopLive } from "@/lib/record-engine";
import { stageCanvas } from "@/lib/stage";
import { useStudio } from "@/lib/store";
import { errorText } from "@/lib/text";
import { normalizeUrl } from "@/lib/url";

function screenError(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError") return "Izin layar ditolak atau dibatalkan.";
  if (name === "NotSupportedError" || name === "SecurityError") {
    return "Mode layar tidak diizinkan di jendela ini. Buka aplikasi di tab penuh, atau pakai Studio.";
  }
  return "Mode layar tidak tersedia. Pakai Studio untuk merekam tautan.";
}

function labelOf(gear: GearSettings, ext: string) {
  return `${gear.resolution} · ${gear.fps}fps · ${ext.toUpperCase()}`;
}

export function useRecorder() {
  const stopRef = useRef<(() => void) | null>(null);
  const cancelRef = useRef(false);

  useEffect(() => () => stopRef.current?.(), []);

  async function toggle() {
    const studio = useStudio.getState();
    if (studio.recording) {
      cancelRef.current = true;
      stopRef.current?.();
      return;
    }
    const gear = effectiveGear(studio.gear, studio.owner);
    if (studio.mode === "studio" && !studio.owner.allowStudio) {
      studio.toastMsg("Mode Studio dimatikan owner");
      return;
    }
    if (studio.mode === "screen" && !studio.owner.allowScreen) {
      studio.toastMsg("Mode Layar dimatikan owner");
      return;
    }
    const canvas = stageCanvas.current;
    if (!canvas) {
      studio.toastMsg("Papan rekam belum siap");
      return;
    }
    cancelRef.current = false;
    stopRef.current = () => {
      cancelRef.current = true;
    };
    studio.setPlayback(null);
    studio.setTimer("00:00");
    studio.setRecording(true);
    stopLive();
    try {
      if (studio.mode === "screen") {
        if (!navigator.mediaDevices?.getDisplayMedia) {
          studio.toastMsg("Browser ini tidak mendukung tangkapan layar");
          return;
        }
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: gear.fps },
            audio: false,
          });
        } catch (error) {
          studio.toastMsg(screenError(error));
          return;
        }
        if (cancelRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          useStudio.getState().toastMsg("Rekaman dibatalkan");
          return;
        }
        let urlLabel = "Layar";
        if (studio.url.trim()) {
          try {
            urlLabel = normalizeUrl(studio.url);
          } catch {
            urlLabel = studio.url.trim();
          }
        }
        const ctrl = beginScreenRecord({
          canvas,
          stream,
          settings: gear,
          urlLabel,
          onTimer: (label) => useStudio.getState().setTimer(label),
          onNotice: (message) => useStudio.getState().toastMsg(message),
        });
        stopRef.current = () => {
          cancelRef.current = true;
          ctrl.stop();
        };
        useStudio.getState().pushLog("Rekam layar dimulai");
        const clip = await ctrl.done;
        if (!clip) {
          useStudio.getState().toastMsg(cancelRef.current ? "Rekaman dibatalkan" : "Rekaman layar kosong");
          return;
        }
        await saveRecording(clip, studio.url.trim() || "Rekaman layar", labelOf(gear, clip.ext));
        return;
      }

      let target = "";
      try {
        target = normalizeUrl(studio.url);
      } catch (error) {
        studio.toastMsg(errorText(error));
        return;
      }
      let doc = studio.doc;
      if (!doc || studio.loadedFor !== target || studio.loadedMode !== "full") {
        doc = await fetchPage("full");
      }
      if (cancelRef.current) {
        useStudio.getState().toastMsg("Rekaman dibatalkan");
        return;
      }
      if (!doc) return;
      const ctrl = beginStudioRecord({
        canvas,
        doc,
        settings: gear,
        onTimer: (label) => useStudio.getState().setTimer(label),
        onNotice: (message) => useStudio.getState().toastMsg(message),
      });
      stopRef.current = () => {
        cancelRef.current = true;
        ctrl.stop();
      };
      useStudio.getState().pushLog(`Rekam studio ${doc.finalUrl}`);
      const clip = await ctrl.done;
      if (!clip) {
        useStudio.getState().toastMsg(cancelRef.current ? "Rekaman dibatalkan" : "Rekaman kosong");
        return;
      }
      await saveRecording(clip, doc.title || doc.finalUrl, labelOf(gear, clip.ext));
    } catch (error) {
      useStudio.getState().toastMsg(errorText(error));
    } finally {
      stopRef.current = null;
      const current = useStudio.getState();
      current.setRecording(false);
      current.setTimer("00:00");
    }
  }

  function preview() {
    const studio = useStudio.getState();
    if (studio.recording) return;
    const canvas = stageCanvas.current;
    if (!canvas || !studio.doc || studio.mode !== "studio") {
      studio.toastMsg("Muat tautan di mode Studio dulu");
      return;
    }
    stopLive();
    beginPreview(canvas, studio.doc, effectiveGear(studio.gear, studio.owner));
    studio.toastMsg("Pratinjau scroll");
  }

  return { toggle, preview };
}
