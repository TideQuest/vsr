import { createWeb3Modal, defaultWagmiConfig } from '@web3modal/wagmi/react'
import { WagmiProvider } from 'wagmi'
import { mainnet } from 'viem/chains'
import { ReactNode, useMemo } from 'react'

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined

export function WalletProvider({ children }: { children: ReactNode }) {
  const enabled = Boolean(projectId)

  const config = useMemo(() => {
    return defaultWagmiConfig({ projectId: projectId || 'disabled', chains: [mainnet] })
  }, [])

  if (enabled) {
    createWeb3Modal({ wagmiConfig: config, projectId: projectId!, enableAnalytics: false })
  }

  return <WagmiProvider config={config}>{children}</WagmiProvider>
}

export function WalletConnectControls() {
  if (!projectId) {
    return (
      <div style={{ padding: 8, border: '1px dashed #ccc' }}>
        WalletConnect disabled. Set VITE_WALLETCONNECT_PROJECT_ID in .env
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <w3m-button />
    </div>
  )
}

