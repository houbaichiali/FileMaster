import { Kind } from '../services/api'

export const FORMATS: Record<Kind, string[]> = {
  image: ['jpg', 'png', 'webp', 'bmp', 'tiff'],
  document: ['pdf', 'docx', 'txt'],
  audio: ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'],
  video: ['mp4', 'mov', 'webm', 'mkv'],
}
export const KINDS: Kind[] = ['image', 'document', 'audio', 'video']

const EXT: Record<Kind, string[]> = {
  image: ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.tif'],
  document: ['.pdf', '.docx', '.txt'],
  audio: ['.mp3', '.wav', '.aac', '.flac', '.ogg', '.m4a'],
  video: ['.mp4', '.mov', '.webm', '.mkv', '.m4a'],
}
export const acceptAttr = (kinds: Kind[]) => kinds.flatMap((k) => EXT[k]).join(',')
export const upper = (f: string) => f.toUpperCase()
