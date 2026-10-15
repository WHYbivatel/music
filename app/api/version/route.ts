import { BUILD, NO_STORE } from '@/lib/version';
export const dynamic='force-dynamic';
export const revalidate=0;
export function GET(){return Response.json(BUILD,{headers:NO_STORE});}
