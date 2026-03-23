import type { AppRoute } from './routes';

export function shouldAutofocusContentAfterMutation(route: AppRoute): boolean {
  return route.name !== 'player';
}
