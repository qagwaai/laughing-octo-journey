export type RenderQuality = 'standard' | 'low';

export function selectRenderQuality(width: number, cores: number, saveData: boolean): RenderQuality {
  return width < 768 || cores <= 4 || saveData ? 'low' : 'standard';
}
