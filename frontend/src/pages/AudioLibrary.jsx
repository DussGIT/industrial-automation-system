import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, Play, Pause, Trash2, Download, Volume2, Plus, X, Edit2, Check } from 'lucide-react'
import api from '../services/api'

export default function AudioLibrary() {
  const queryClient = useQueryClient()
  const [selectedAudio, setSelectedAudio] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioElement, setAudioElement] = useState(null)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  
  // TTS Tester state
  const [ttsText, setTtsText] = useState('')
  const [ttsVoice, setTtsVoice] = useState('en_US-lessac-medium')
  const [ttsSpeed, setTtsSpeed] = useState('1.0')
  const [ttsLoading, setTtsLoading] = useState(false)
  const [ttsError, setTtsError] = useState(null)
  const [ttsAudioUrl, setTtsAudioUrl] = useState(null)

  const { data: audioFiles = [], isLoading } = useQuery({
    queryKey: ['audioFiles'],
    queryFn: async () => await api.get('/audio'),
  })

  const uploadMutation = useMutation({
    mutationFn: async (formData) => {
      return await api.post('/audio/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['audioFiles'])
      setUploadModalOpen(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => await api.post(`/audio/${id}/delete`),
    onSuccess: () => {
      queryClient.invalidateQueries(['audioFiles'])
      if (selectedAudio?.id === deleteMutation.variables) {
        setSelectedAudio(null)
        if (audioElement) {
          audioElement.pause()
          setIsPlaying(false)
        }
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, name }) => await api.post(`/audio/${id}/update`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries(['audioFiles'])
      setEditingId(null)
    },
  })

  const handleFileUpload = (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    uploadMutation.mutate(formData)
  }

  const handlePlay = (audio) => {
    if (audioElement) {
      audioElement.pause()
    }

    if (selectedAudio?.id === audio.id && isPlaying) {
      setIsPlaying(false)
      return
    }

    const newAudio = new Audio(`/api/audio/${audio.id}/stream`)
    newAudio.play()
    newAudio.onended = () => setIsPlaying(false)
    
    setAudioElement(newAudio)
    setSelectedAudio(audio)
    setIsPlaying(true)
  }

  const handlePause = () => {
    if (audioElement) {
      audioElement.pause()
      setIsPlaying(false)
    }
  }

  const handleDownload = (audio) => {
    window.open(`/api/audio/${audio.id}/download`, '_blank')
  }

  const startEdit = (audio) => {
    setEditingId(audio.id)
    setEditName(audio.name)
  }

  const saveEdit = (id) => {
    updateMutation.mutate({ id, name: editName })
  }

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleTtsTest = async () => {
    if (!ttsText.trim()) {
      setTtsError('Please enter some text')
      return
    }

    setTtsLoading(true)
    setTtsError(null)
    setTtsAudioUrl(null)

    try {
      const response = await api.post('/audio/tts/test', {
        text: ttsText,
        voice: ttsVoice,
        speed: ttsSpeed
      })

      if (response.audioUrl) {
        setTtsAudioUrl(response.audioUrl)
        // Auto-play the generated audio
        const audio = new Audio(response.audioUrl)
        audio.play()
      }
    } catch (error) {
      setTtsError(error.response?.data?.error || error.message || 'TTS generation failed')
    } finally {
      setTtsLoading(false)
    }
  }

  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause()
      }
    }
  }, [audioElement])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Audio Library</h1>
          <p className="text-gray-400 mt-1">
            Manage audio recordings for radio broadcasts and playback
          </p>
        </div>
        <button
          onClick={() => setUploadModalOpen(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
        >
          <Upload className="w-4 h-4" />
          Upload Audio
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600/20 rounded-lg">
              <Volume2 className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Files</p>
              <p className="text-2xl font-bold text-white">{audioFiles.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-600/20 rounded-lg">
              <Play className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Duration</p>
              <p className="text-2xl font-bold text-white">
                {formatDuration(audioFiles.reduce((sum, f) => sum + (f.duration || 0), 0))}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-600/20 rounded-lg">
              <Upload className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Size</p>
              <p className="text-2xl font-bold text-white">
                {formatFileSize(audioFiles.reduce((sum, f) => sum + (f.size || 0), 0))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Audio Files List */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Size
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Format
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Uploaded
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-400">
                    Loading audio files...
                  </td>
                </tr>
              ) : audioFiles.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-400">
                    No audio files yet. Upload your first recording!
                  </td>
                </tr>
              ) : (
                audioFiles.map((audio) => (
                  <tr
                    key={audio.id}
                    className={`hover:bg-gray-700/50 transition-colors ${
                      selectedAudio?.id === audio.id ? 'bg-gray-700/30' : ''
                    }`}
                  >
                    <td className="px-6 py-4">
                      {editingId === audio.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="px-2 py-1 bg-gray-900 border border-gray-600 rounded text-white text-sm"
                            autoFocus
                          />
                          <button
                            onClick={() => saveEdit(audio.id)}
                            className="p-1 text-green-400 hover:text-green-300"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1 text-gray-400 hover:text-gray-300"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{audio.name}</span>
                          <button
                            onClick={() => startEdit(audio)}
                            className="p-1 text-gray-400 hover:text-gray-300"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-300">
                      {audio.duration ? formatDuration(audio.duration) : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-300">
                      {formatFileSize(audio.size)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-300 uppercase">
                      {audio.format}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-300">
                      {new Date(audio.created_at * 1000).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() =>
                            selectedAudio?.id === audio.id && isPlaying
                              ? handlePause()
                              : handlePlay(audio)
                          }
                          className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 rounded transition-colors"
                          title={selectedAudio?.id === audio.id && isPlaying ? 'Pause' : 'Play'}
                        >
                          {selectedAudio?.id === audio.id && isPlaying ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDownload(audio)}
                          className="p-2 text-green-400 hover:text-green-300 hover:bg-green-400/10 rounded transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete "${audio.name}"?`)) {
                              deleteMutation.mutate(audio.id)
                            }
                          }}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* TTS Tester */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Volume2 className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-bold text-white">Text-to-Speech Tester</h2>
          <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-1 rounded">Preview Only</span>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Test how your text will sound before using it in flows. Audio is generated temporarily and not saved.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Text to Speak
            </label>
            <textarea
              value={ttsText}
              onChange={(e) => setTtsText(e.target.value)}
              placeholder="Enter text to convert to speech..."
              rows="3"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Voice Model
            </label>
            <select
              value={ttsVoice}
              onChange={(e) => setTtsVoice(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="en_US-lessac-medium">English (US) - Lessac (Medium)</option>
              <option value="en_US-lessac-low">English (US) - Lessac (Low Quality)</option>
              <option value="en_US-libritts-high">English (US) - LibriTTS (High Quality)</option>
              <option value="en_GB-alan-medium">English (GB) - Alan (Medium)</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Speed
            </label>
            <select
              value={ttsSpeed}
              onChange={(e) => setTtsSpeed(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="0.75">0.75x (Slower)</option>
              <option value="1.0">1.0x (Normal)</option>
              <option value="1.25">1.25x (Faster)</option>
              <option value="1.5">1.5x (Very Fast)</option>
            </select>
          </div>
          
          <div className="md:col-span-2">
            <button
              onClick={handleTtsTest}
              disabled={ttsLoading || !ttsText.trim()}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              {ttsLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Generate & Preview
                </>
              )}
            </button>
          </div>
          
          {ttsError && (
            <div className="md:col-span-2 p-3 bg-red-900/20 border border-red-600 rounded-lg">
              <p className="text-sm text-red-400">{ttsError}</p>
            </div>
          )}
          
          {ttsAudioUrl && (
            <div className="md:col-span-2 p-3 bg-green-900/20 border border-green-600 rounded-lg">
              <p className="text-sm text-green-400">✓ TTS generated successfully! Audio is playing.</p>
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Upload Audio File</h2>
              <button
                onClick={() => setUploadModalOpen(false)}
                className="p-1 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleFileUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Audio File
                </label>
                <input
                  type="file"
                  name="audio"
                  accept="audio/*"
                  required
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Supported formats: MP3, WAV, OGG, M4A
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  placeholder="Enter audio name..."
                  required
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  name="description"
                  placeholder="Enter description..."
                  rows="3"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
