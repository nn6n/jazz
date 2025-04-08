import { JazzLogo } from 'gcmp-design-system/src/app/components/atoms/logos/JazzLogo'
import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const alt = 'Whip up an app'
export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default async function Image() {
  const manropeRegular = await readFile(
    join(process.cwd(), 'assets/fonts/Manrope-Regular.ttf')
  )

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 111,
          background: 'white',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          margin: '20px',
        }}
      >
        Whip up an app
        <div style={{ display: 'flex', position: 'absolute', bottom: 0, right: 0 }}>
          <JazzLogo className="w-20" />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: 'Manrope',
          data: manropeRegular,
          style: 'normal',
          weight: 400,
        },
      ],
    }
  )
}