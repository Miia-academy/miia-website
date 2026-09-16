import React, { useState } from 'react'
import { Button, ButtonProps } from '@heroui/react'

interface LogoutButtonProps extends Omit<ButtonProps, 'onPress'> {
  redirectTo?: string
  label?: string
}

export function LogoutButton({
  redirectTo = '/',
  label = 'Esci',
  className,
  variant = 'flat',
  color = 'danger',
  ...props
}: LogoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleLogout = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/logout', {
        method: 'POST'
      })

      if (res.ok) {
        // Utilizziamo window.location per forzare un hard refresh
        // Questo garantisce lo smontaggio dell'albero React e la pulizia di eventuali Context/Stati in memoria
        window.location.href = redirectTo
      } else {
        console.error('Errore durante il logout')
        setIsLoading(false)
      }
    } catch (error) {
      console.error('Errore di connessione durante il logout', error)
      setIsLoading(false)
    }
  }

  return (
    <Button
      color={color}
      variant={variant}
      isLoading={isLoading}
      onPress={handleLogout}
      className={`font-semibold ${className || ''}`}
      {...props}
    >
      {label}
    </Button>
  )
}