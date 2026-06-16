import { Platform } from 'react-native';
import { registerRootComponent } from 'expo';

import App from './App';

if (Platform.OS === 'web') {
  // viewport-fit=cover : indispensable pour les insets iOS (notch, barre home)
  const vp = document.querySelector('meta[name="viewport"]');
  if (vp) {
    vp.setAttribute(
      'content',
      'width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover',
    );
  }

  const style = document.createElement('style');
  style.id = 'athly-web';
  style.textContent = `
    * { -webkit-tap-highlight-color: transparent; }
    html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
    body {
      background: #030406;
      overscroll-behavior: none;
      -webkit-user-select: none;
      user-select: none;
    }
    input, textarea { -webkit-user-select: text !important; user-select: text !important; }
  `;
  document.head.appendChild(style);
}

registerRootComponent(App);
