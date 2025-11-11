import React from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'

const Interfaces = () => {
  const { data: types } = useQuery({
    queryKey: ['interfaceTypes'],
    queryFn: api.getInterfaceTypes
  })

  const interfaceTypes = types?.types || []

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-2">Interfaces</h1>
      <p className="text-gray-400 mb-8">Configure communication interfaces</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {interfaceTypes.map(type => (
          <div
            key={type.type}
            className="bg-dark-surface rounded-lg border border-dark-border p-6 hover:border-primary transition-colors cursor-pointer"
          >
            <div className="mb-2">
              <span className="text-xs text-gray-500 uppercase">{type.category}</span>
            </div>
            <h3 className="text-lg font-semibold mb-2">{type.name}</h3>
            <p className="text-sm text-gray-400">{type.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Interfaces
