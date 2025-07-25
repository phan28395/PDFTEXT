// Supabase Edge Function for PDF Processing
// Uses Deno runtime - different from Node.js!

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Parse request
    const { action, fileName, range } = await req.json()

    switch (action) {
      case 'analyze':
        return await analyzePDF(supabaseClient, fileName)
      
      case 'preview':
        return await generatePreview(supabaseClient, fileName, range)
      
      default:
        throw new Error('Invalid action')
    }

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function analyzePDF(supabase: any, fileName: string) {
  // Download PDF from storage
  const { data, error } = await supabase.storage
    .from('pdfs')
    .download(fileName)
  
  if (error) throw error
  
  // Convert blob to Uint8Array for pdf-lib
  const arrayBuffer = await data.arrayBuffer()
  const pdfDoc = await PDFDocument.load(arrayBuffer)
  
  const metadata = {
    type: 'pdf',
    totalUnits: pdfDoc.getPageCount(),
    unitName: 'pages',
    fileName: fileName.split('/').pop(),
    fileSize: arrayBuffer.byteLength,
  }
  
  return new Response(
    JSON.stringify(metadata),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
}

async function generatePreview(supabase: any, fileName: string, range: any) {
  const startTime = Date.now()
  
  // Download PDF from storage
  const { data: pdfData, error: downloadError } = await supabase.storage
    .from('pdfs')
    .download(fileName)
  
  if (downloadError) throw downloadError
  
  const arrayBuffer = await pdfData.arrayBuffer()
  const pdfDoc = await PDFDocument.load(arrayBuffer)
  const totalPages = pdfDoc.getPageCount()
  
  // Calculate pages to preview
  const startPage = range.all ? 1 : Math.max(1, range.start)
  const endPage = range.all ? totalPages : Math.min(range.end, totalPages)
  
  // Smart preview selection for large documents
  let pagesToPreview: number[] = []
  
  if (endPage - startPage + 1 <= 15) {
    // Show all pages if 15 or less
    for (let i = startPage; i <= endPage; i++) {
      pagesToPreview.push(i)
    }
  } else {
    // Strategic sampling for large documents
    pagesToPreview = [
      startPage,
      startPage + 1,
      startPage + 2,
      Math.floor((startPage + endPage) * 0.25),
      Math.floor((startPage + endPage) * 0.5),
      Math.floor((startPage + endPage) * 0.75),
      endPage - 2,
      endPage - 1,
      endPage
    ]
    // Remove duplicates and sort
    pagesToPreview = [...new Set(pagesToPreview)].sort((a, b) => a - b)
  }
  
  const units = []
  
  for (const pageNum of pagesToPreview) {
    // Create single-page PDF
    const singlePageDoc = await PDFDocument.create()
    const [page] = await singlePageDoc.copyPages(pdfDoc, [pageNum - 1])
    singlePageDoc.addPage(page)
    
    // Convert to image (simplified - in production use pdf-to-image service)
    const pdfBytes = await singlePageDoc.save()
    
    // For now, we'll store the single-page PDF
    // In production, you'd convert this to an image using a service
    const previewFileName = `previews/${fileName.replace('.pdf', '')}/page-${pageNum}.pdf`
    
    const { error: uploadError } = await supabase.storage
      .from('pdf-previews')
      .upload(previewFileName, pdfBytes, {
        contentType: 'application/pdf',
        cacheControl: '3600'
      })
    
    if (uploadError && uploadError.message !== 'The resource already exists') {
      throw uploadError
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('pdf-previews')
      .getPublicUrl(previewFileName)
    
    units.push({
      index: pageNum,
      imageUrl: publicUrl,
      thumbnail: publicUrl, // Same for now
      isPDF: true // Flag to indicate this is still PDF, not image
    })
  }
  
  // Add gap indicators
  const unitsWithGaps = []
  for (let i = 0; i < units.length; i++) {
    unitsWithGaps.push(units[i])
    
    if (i < units.length - 1) {
      const currentPage = units[i].index
      const nextPage = units[i + 1].index
      
      if (nextPage - currentPage > 1) {
        unitsWithGaps.push({
          isGap: true,
          startPage: currentPage + 1,
          endPage: nextPage - 1,
          count: nextPage - currentPage - 1
        })
      }
    }
  }
  
  const processingTime = Date.now() - startTime
  
  return new Response(
    JSON.stringify({
      units: unitsWithGaps,
      processingTime,
      totalPages,
      previewedPages: pagesToPreview.length
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
}

// Helper to clean up old previews (run periodically)
async function cleanupOldPreviews(supabase: any) {
  const { data: files } = await supabase.storage
    .from('pdf-previews')
    .list('previews', {
      limit: 1000,
    })
  
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  
  for (const file of files || []) {
    if (new Date(file.created_at) < oneHourAgo) {
      await supabase.storage
        .from('pdf-previews')
        .remove([`previews/${file.name}`])
    }
  }
}