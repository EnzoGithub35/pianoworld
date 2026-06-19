import { describe, expect, it, vi, beforeEach } from 'vitest'
import imageCompression from 'browser-image-compression'
import { compressPhoto, validatePhotoFile } from '@/lib/photo'

/**
 * Sprint 7 sécu (A.7 backlog) — test régression EXIF strip.
 *
 * On NE teste PAS le comportement réel de browser-image-compression (qui
 * nécessite un canvas, indispo en jsdom). On teste le CONTRACT côté nous :
 * la fonction `compressPhoto` doit appeler la lib avec `preserveExif: false`
 * explicite. Si un futur refactor retire ce flag (default lib reste false
 * mais le risque de régression silencieuse existe), ce test fail.
 *
 * Pour un test bout-en-bout EXIF→buffer, il faudrait un polyfill canvas npm
 * — surcoût CI > bénéfice (la lib est largement éprouvée upstream).
 */
vi.mock('browser-image-compression', () => ({
  default: vi.fn(async (file: File) => file)
}))

const mockedCompression = vi.mocked(imageCompression)

function makeFakeImage(name = 'piano.jpg', size = 1024 * 1024): File {
  const blob = new Blob([new Uint8Array(size)], { type: 'image/jpeg' })
  return new File([blob], name, { type: 'image/jpeg' })
}

describe('compressPhoto — RGPD EXIF strip (A.7)', () => {
  beforeEach(() => {
    mockedCompression.mockClear()
  })

  it('appelle browser-image-compression avec preserveExif: false (explicite)', async () => {
    const file = makeFakeImage()
    await compressPhoto(file)
    expect(mockedCompression).toHaveBeenCalledOnce()
    const [, opts] = mockedCompression.mock.calls[0]
    expect(opts).toMatchObject({ preserveExif: false })
  })

  it('force le re-encode JPEG (fileType: image/jpeg) qui élimine EXIF', async () => {
    const file = makeFakeImage('piano.png', 500_000)
    await compressPhoto(file)
    const [, opts] = mockedCompression.mock.calls[0]
    expect(opts).toMatchObject({ fileType: 'image/jpeg' })
  })

  it("propage l'erreur de compression sans masquer (rollback Storage possible)", async () => {
    mockedCompression.mockRejectedValueOnce(new Error('boom'))
    await expect(compressPhoto(makeFakeImage())).rejects.toThrow('boom')
  })
})

describe('validatePhotoFile', () => {
  it('refuse un fichier non-image', () => {
    const txt = new File(['hello'], 'note.txt', { type: 'text/plain' })
    expect(() => validatePhotoFile(txt)).toThrow(/image/i)
  })

  it('accepte un JPEG normal', () => {
    expect(() => validatePhotoFile(makeFakeImage())).not.toThrow()
  })

  it('refuse une image > 20 Mo (sécurité avant compression)', () => {
    const huge = makeFakeImage('huge.jpg', 21 * 1024 * 1024)
    expect(() => validatePhotoFile(huge)).toThrow(/lourde|max/i)
  })
})
