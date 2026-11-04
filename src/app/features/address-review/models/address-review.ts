import { HomeAddress } from '../../employee/models/person';

/** Pedido de troca de endereço enviado pelo colaborador no app (GET address-reviews/). */
export interface AddressReviewRequest {
  id: number;
  status: 'pending' | 'approved' | 'rejected';
  person: { id: number; name: string; code: string | null; type: 'EMPLOYEE' | 'DRIVER' };
  address: HomeAddress;
  nearest_point: { id: number; name: string; distance_m: number } | null;
  previous_address: HomeAddress | null;
  /** Distância entre o endereço anterior e o novo, em metros. */
  moved_m: number | null;
  current_routes: { route_id: number; name: string; arrival: string | null; stop: string | null }[];
  suggestions: RouteSuggestion[];
  reviewed_by: string | null;
  /** Só na resposta da aprovação: o que mudou nas rotas. */
  changes?: string[];
}

/** Rota fixa com parada perto da casa nova. */
export interface RouteSuggestion {
  route_id: number;
  name: string;
  arrival: string | null;
  weekdays: string[];
  stop_id: number;
  stop: string;
  distance_m: number;
  load: number;
  capacity: number;
  free_seats: number;
  already_on_route: boolean;
  /** Parada a mais de 2 km da casa (só aparece quando nenhuma rota passa mais perto). */
  far: boolean;
  /** Como embarcaria se incluído: parada da rota a até 500 m, ponto da empresa que entra na rota, ou a porta de casa. */
  pickup: 'route' | 'new_point' | 'home';
  /** Com pickup = new_point: o ponto de encontro que vira parada nova. */
  pickup_point: string | null;
}
