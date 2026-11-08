import { createAuthorAvatarResolver, createGithubAvatarLookup } from '../lib/authorAvatar'

export const resolveAuthorAvatar = createAuthorAvatarResolver(
  (url) =>
    new Promise<boolean>((resolve) => {
      const image = new Image()
      const finish = (loaded: boolean) => {
        clearTimeout(timeout)
        image.onload = null
        image.onerror = null
        if (!loaded) image.removeAttribute('src')
        resolve(loaded)
      }
      const timeout = setTimeout(() => finish(false), 6000)

      image.referrerPolicy = 'no-referrer'
      image.onload = () => finish(true)
      image.onerror = () => finish(false)
      image.src = url
    }),
  createGithubAvatarLookup()
)
