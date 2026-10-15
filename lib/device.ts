export function isHandheldDevice(ua: string, platform: string, maxTouchPoints: number) {
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  if (platform === 'MacIntel' && maxTouchPoints > 1) return true;
  if (/Android/i.test(ua)) return true;
  return /Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}
