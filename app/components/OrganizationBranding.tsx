"use client";

import { useState, useEffect, useRef, ChangeEvent } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";

export function OrganizationBranding() {
  const organizations = useQuery(api.organizations.list);
  const org = organizations?.[0] ?? null;
  const isLoading = organizations === undefined;

  const updateOrg = useMutation(api.organizations.update);
  const createAssetUpload = useAction(api.r2.createAssetUpload);
  const confirmAssetUpload = useAction(api.r2.confirmAssetUpload);

  // Accordion Sections State (iOS open by default)
  const [openSection, setOpenSection] = useState<"ios" | "android" | "pdf" | null>("ios");

  // App Clip iOS Image State
  const [iosHeaderImage, setIosHeaderImage] = useState<string>("");
  const [iosAssetId, setIosAssetId] = useState<string>("");
  const [isUploadingIos, setIsUploadingIos] = useState(false);

  // Android Instant App Logo State
  const [androidLogoImage, setAndroidLogoImage] = useState<string>("");
  const [androidAssetId, setAndroidAssetId] = useState<string>("");
  const [isUploadingAndroid, setIsUploadingAndroid] = useState(false);

  // PDF Document Logo State
  const [pdfLogoImage, setPdfLogoImage] = useState<string>("");
  const [pdfAssetId, setPdfAssetId] = useState<string>("");
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);

  // Toast & Error Message
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Hidden File Input Refs
  const iosFileInputRef = useRef<HTMLInputElement>(null);
  const androidFileInputRef = useRef<HTMLInputElement>(null);
  const pdfFileInputRef = useRef<HTMLInputElement>(null);

  // Sync state when organization data loads
  useEffect(() => {
    if (!org) return;
    const mainLogo = org.logoUrl || "";
    const mainAsset = (org as any).logoAssetId || "";

    // Sync logos from org or fallback
    if (!pdfLogoImage && mainLogo) setPdfLogoImage(mainLogo);
    if (!pdfAssetId && mainAsset) setPdfAssetId(mainAsset);

    if (!androidLogoImage && mainLogo) setAndroidLogoImage(mainLogo);
    if (!androidAssetId && mainAsset) setAndroidAssetId(mainAsset);

    if (!iosHeaderImage && mainLogo) setIosHeaderImage(mainLogo);
    if (!iosAssetId && mainAsset) setIosAssetId(mainAsset);
  }, [org]);

  // Show Toast Helper
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const toggleAccordion = (section: "ios" | "android" | "pdf") => {
    setOpenSection((prev) => (prev === section ? null : section));
  };

  // Generic R2 Upload Handler
  const handleFileUpload = async (
    file: File,
    assetType: "logo" | "icon" | "document",
    setImageState: (url: string) => void,
    setAssetIdState: (id: string) => void,
    setUploadingState: (loading: boolean) => void,
    successMsg: string
  ) => {
    if (!file || !org?._id) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("File size exceeds 5MB limit.");
      return;
    }

    setUploadingState(true);
    setErrorMessage(null);

    try {
      const uploadResult = await createAssetUpload({
        assetType,
        fileName: file.name,
        contentType: file.type || "image/png",
        fileSize: file.size,
        organizationId: org._id,
      });

      const putResult = await fetch(uploadResult.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "image/png" },
        body: file,
      });

      if (!putResult.ok) {
        throw new Error(`Upload failed with status ${putResult.status}`);
      }

      await confirmAssetUpload({ assetId: uploadResult.assetId });

      const previewUrl = URL.createObjectURL(file);
      setImageState(previewUrl);
      setAssetIdState(uploadResult.assetId);

      // Also persist to org if uploading main logo / pdf logo
      if (assetType === "logo" || assetType === "document") {
        await updateOrg({
          id: org._id,
          logoUrl: previewUrl,
          logoAssetId: uploadResult.assetId,
        });
      }

      showToast(successMsg);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to upload image.");
    } finally {
      setUploadingState(false);
    }
  };

  // Handlers for iOS App Clip Header Image
  const handleIosFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(
        file,
        "logo",
        setIosHeaderImage,
        setIosAssetId,
        setIsUploadingIos,
        "App Clip iOS header image updated"
      );
    }
  };

  const handleRemoveIosImage = () => {
    setIosHeaderImage("");
    setIosAssetId("");
    showToast("App Clip header image removed");
  };

  // Handlers for Android Instant App Logo
  const handleAndroidFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(
        file,
        "icon",
        setAndroidLogoImage,
        setAndroidAssetId,
        setIsUploadingAndroid,
        "Instant App Android logo updated"
      );
    }
  };

  const handleRemoveAndroidImage = () => {
    setAndroidLogoImage("");
    setAndroidAssetId("");
    showToast("Instant App logo removed");
  };

  // Handlers for PDF Document Logo
  const handlePdfFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(
        file,
        "document",
        setPdfLogoImage,
        setPdfAssetId,
        setIsUploadingPdf,
        "PDF document logo updated"
      );
    }
  };

  const handleRemovePdfImage = async () => {
    setPdfLogoImage("");
    setPdfAssetId("");
    if (org?._id) {
      try {
        await updateOrg({
          id: org._id,
          logoUrl: "",
          logoAssetId: "",
        });
      } catch (err) {}
    }
    showToast("PDF document logo removed");
  };

  if (isLoading) {
    return (
      <div className="py-16 text-center">
        <div className="w-8 h-8 mx-auto border-2 border-[#141010] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium text-[#5e5e5e]">Loading Branding Settings...</p>
      </div>
    );
  }

  const orgName = org?.name || "Skyz Restaurant & Banquet";
  const defaultHeaderImg =
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAeUlqLffhXNyBRDv4fPR5dYAmCPxnkfqwUvSYgI6QZEsjkChJ4lx129E4sK8C1qtNg5BJpaGVhU6MO7qSttNSn6cNgRJjce7xewuRJnqKbPwVbwhfrs_3CDTAiHAYxMUErLFweI_ep2UMlXFxH0tZn-6lbBJyVsQjBQRjupGiR2uRB6huG62Gvpqbp7QquIpEIM1o-wj6wTaw2Y8niev6b6Ng1qJg3kPJH9nevsyUnroxMLexOb2pO8uRfiufcAaCfig";
  const defaultAppClipCover =
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDisUMIID1X4NPLEdBxP7ZKIZ8tIx8eQ_a7K-3CrOf9c6nSDSqw3SFDK_bAxNQmNSXAnaShPKYjHX5s0pqm_3ga05bSQNKTRwX9bQO0eBCawvIPedhhhFpxEM9UvQFWgrYAJvLKp72xmd7lWgxuhDNmUXXBaYiqdQN8FNECao_rV2p4b8mflt_ATLeM8ZanQu98f53qmNYRGVvgJfPjlu4ctVZT0HF1SAMiPjWNui1rU5a8idRjfRfL9xTxTImy5c6IPw";
  const defaultAndroidLogo =
    "https://lh3.googleusercontent.com/aida-public/AB6AXuA2QJm69FJ3ZCyWkGoWAxImbRevIt0dqLd_Et_knlNsglK39LYM0RR7dZ5cNAvN0sKZspUjH3zkvutxeo8W9DA1TZmsEswGP6c0pZWpPTW6KQZu-9eLKstZ374rRJDQzuEYRrwQHArC48ouoWp3BYj7BHRMdOoGOkNNHUJ9Rm2goGg3x2bVwyQaUUj0Ai4TY08UdkVMZggGJXRPqkISCfZlm1vGvSlytl7f40rq_I7aogNrXvkZcyZBc1-mQQ_ekI4UxA";

  return (
    <div className="space-y-8 select-none">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={iosFileInputRef}
        onChange={handleIosFileChange}
        accept="image/jpeg,image/png"
        className="hidden"
      />
      <input
        type="file"
        ref={androidFileInputRef}
        onChange={handleAndroidFileChange}
        accept="image/jpeg,image/png"
        className="hidden"
      />
      <input
        type="file"
        ref={pdfFileInputRef}
        onChange={handlePdfFileChange}
        accept="image/jpeg,image/png"
        className="hidden"
      />

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0C0A09] text-white text-xs px-4 py-3 rounded-lg shadow-xl flex items-center space-x-2.5 border border-stone-700 animate-fadeIn">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs font-medium flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-500 hover:text-red-800 text-sm font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Page Header with Action Button */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#E7E5E4] pb-6">
        <div>
          <h1 className="font-serif text-[32px] font-normal text-[#141010] leading-tight">
            Branding
          </h1>
          <p className="text-sm text-[#5E5E5E] mt-1 font-normal">
            Manage the images and logos used in your restaurant's apps and documents.
          </p>
        </div>
        <div>
          <a
            href="https://dev.get-prest.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#0C0A09] hover:bg-black text-white px-5 py-2.5 rounded-lg text-sm font-medium tracking-tight shadow-sm transition-all duration-150"
          >
            <span>Visit online store</span>
            <svg className="w-3.5 h-3.5 stroke-current" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </a>
        </div>
      </div>

      {/* Accordion Group Container */}
      <div className="space-y-4">
        {/* ================================================== */}
        {/* ACCORDION SECTION 1: APP CLIP IOS                 */}
        {/* ================================================== */}
        <div className="border border-[#E7E5E4] rounded-xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => toggleAccordion("ios")}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-stone-50/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${iosHeaderImage ? "bg-emerald-500" : "bg-stone-400"}`} />
              <h3 className="font-serif text-[22px] font-normal text-[#141010]">
                App clip iOS
              </h3>
            </div>
            <svg
              className={`w-5 h-5 text-stone-500 transform transition-transform duration-200 ${
                openSection === "ios" ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
            </svg>
          </button>

          {openSection === "ios" && (
            <div className="px-6 pb-8 pt-2 border-t border-[#F0EEED] space-y-6 block">
              <p className="text-xs text-[#5E5E5E] max-w-2xl leading-relaxed">
                Choose the image customers see when they open your restaurant's iPhone App Clip.
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left Column: Config */}
                <div className="lg:col-span-6 space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-neutral-800">
                        Header image
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => iosFileInputRef.current?.click()}
                          title="Change image"
                          disabled={isUploadingIos}
                          className="p-1.5 text-stone-500 hover:text-stone-900 rounded hover:bg-stone-100 transition-colors disabled:opacity-50"
                        >
                          <svg className="w-4 h-4 stroke-current" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                          </svg>
                        </button>
                        {iosHeaderImage && (
                          <button
                            type="button"
                            onClick={handleRemoveIosImage}
                            title="Remove image"
                            className="p-1.5 text-stone-400 hover:text-rose-600 rounded hover:bg-stone-100 transition-colors"
                          >
                            <svg className="w-4 h-4 stroke-current" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      <p className="text-xs text-[#5E5E5E]">
                        Add the image you want to show at the top of your App Clip.
                      </p>
                      <p className="text-[11px] text-stone-500">
                        Use a high-quality JPG or PNG image (1800×1200 px) without a transparent background.
                      </p>
                    </div>
                  </div>

                  {/* Uploaded Thumbnail Card */}
                  <div
                    onClick={() => iosFileInputRef.current?.click()}
                    className="relative group rounded-xl overflow-hidden border border-[#E7E5E4] bg-stone-100 aspect-[3/2] max-w-sm shadow-sm cursor-pointer"
                  >
                    <img
                      src={iosHeaderImage || defaultHeaderImg}
                      alt="App Clip iOS Header"
                      className="w-full h-full object-cover object-center transform group-hover:scale-[1.02] transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/5 pointer-events-none" />
                    {isUploadingIos && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs font-medium">
                        Uploading...
                      </div>
                    )}
                  </div>

                  <div className="text-[11px] text-stone-500 flex items-center gap-2">
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${iosHeaderImage ? "bg-emerald-500" : "bg-stone-400"}`} />
                    <span>{iosHeaderImage ? "1800 × 1200 px • JPG • Uploaded" : "Default App Clip Header"}</span>
                  </div>
                </div>

                {/* Right Column: iPhone Frame Preview */}
                <div className="lg:col-span-6 bg-[#FAF7F6] rounded-xl p-6 flex flex-col items-center justify-center border border-[#ECE8E6]">
                  <div className="mb-4 text-center">
                    <span className="block text-[11px] uppercase tracking-wider text-stone-400 font-medium">
                      App preview
                    </span>
                    <span className="block text-[10px] text-stone-400 mt-0.5">
                      This is how the image may appear to customers.
                    </span>
                  </div>

                  {/* iPhone Phone Frame Simulator */}
                  <div className="w-[280px] sm:w-[300px] h-[580px] bg-neutral-900 rounded-[44px] p-2.5 shadow-2xl relative border-[3px] border-stone-300">
                    <div className="w-full h-full bg-[#111] rounded-[36px] overflow-hidden relative flex flex-col justify-between">
                      {/* Top Gradient Wallpaper */}
                      <div className="absolute inset-0 bg-gradient-to-br from-[#E62E44] via-[#D81B60] to-[#FF8C00] z-0" />

                      {/* Dynamic Island Header */}
                      <div className="relative z-20 w-full pt-3 px-6 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-white/90">9:41</span>
                        <div className="w-20 h-4 bg-black rounded-full mx-auto" />
                        <div className="flex items-center gap-1 text-white/90">
                          <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                            <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L12 22l7.03-4.39C20.26 16.07 21 14.12 21 12c0-4.97-4.03-9-9-9z" />
                          </svg>
                          <div className="w-4 h-2 border border-white rounded-sm p-0.5">
                            <div className="h-full w-2 bg-white" />
                          </div>
                        </div>
                      </div>

                      <div className="flex-1" />

                      {/* Bottom Floating App Clip Sheet Overlay */}
                      <div className="relative z-10 bg-white rounded-t-3xl pt-2 pb-5 px-4 shadow-[0_-10px_25px_rgba(0,0,0,0.3)]">
                        <div className="flex justify-between items-center px-1 mb-2">
                          <div className="w-8 h-1 bg-stone-200 rounded-full mx-auto -mr-3" />
                          <button type="button" className="w-5 h-5 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 text-xs">
                            ✕
                          </button>
                        </div>

                        {/* Cover Image in Phone Overlay */}
                        <div className="rounded-xl overflow-hidden aspect-[16/9] mb-3 border border-stone-100 shadow-sm bg-stone-100">
                          <img
                            src={iosHeaderImage || defaultAppClipCover}
                            alt="Skyz Restaurant Thumbnail"
                            className="w-full h-full object-cover"
                          />
                        </div>

                        {/* Title & Order Now CTA */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div>
                            <h4 className="text-[13px] font-semibold text-neutral-900 leading-tight">
                              {orgName}
                            </h4>
                            <p className="text-[10px] text-stone-500">Fast Table Ordering</p>
                          </div>
                          <button type="button" className="bg-[#0C0A09] text-white text-[11px] font-medium px-3.5 py-1.5 rounded-full shrink-0 shadow-sm hover:bg-neutral-800">
                            Order now
                          </button>
                        </div>

                        {/* App Clip Footer Note */}
                        <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[9px] text-stone-400">
                          <span className="flex items-center gap-1 font-medium text-stone-600">
                            <span className="w-3 h-3 bg-black text-white rounded flex items-center justify-center text-[7px] font-serif">P</span>
                            Powered by PREST
                          </span>
                          <span className="hover:underline cursor-pointer text-blue-600">Visit Website ›</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ================================================== */}
        {/* ACCORDION SECTION 2: INSTANT APP ANDROID           */}
        {/* ================================================== */}
        <div className="border border-[#E7E5E4] rounded-xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => toggleAccordion("android")}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-stone-50/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${androidLogoImage ? "bg-emerald-500" : "bg-stone-300"}`} />
              <h3 className="font-serif text-[22px] font-normal text-[#141010]">
                Instant App Android
              </h3>
            </div>
            <svg
              className={`w-5 h-5 text-stone-500 transform transition-transform duration-200 ${
                openSection === "android" ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
            </svg>
          </button>

          {openSection === "android" && (
            <div className="px-6 pb-8 pt-2 border-t border-[#F0EEED] space-y-6 block">
              <p className="text-xs text-[#5E5E5E] max-w-2xl leading-relaxed">
                Choose the image customers see when they open your restaurant's Android Instant App.
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left Column */}
                <div className="lg:col-span-6 space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-neutral-800">
                        Instant app logo
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => androidFileInputRef.current?.click()}
                          title="Change image"
                          disabled={isUploadingAndroid}
                          className="p-1.5 text-stone-500 hover:text-stone-900 rounded hover:bg-stone-100 transition-colors disabled:opacity-50"
                        >
                          <svg className="w-4 h-4 stroke-current" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                          </svg>
                        </button>
                        {androidLogoImage && (
                          <button
                            type="button"
                            onClick={handleRemoveAndroidImage}
                            title="Remove image"
                            className="p-1.5 text-stone-400 hover:text-rose-600 rounded hover:bg-stone-100 transition-colors"
                          >
                            <svg className="w-4 h-4 stroke-current" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-[#5E5E5E] mt-1">
                      Add the image you want to show in your Android app.
                    </p>
                  </div>

                  {/* Thumbnail Card */}
                  <div
                    onClick={() => androidFileInputRef.current?.click()}
                    className="relative group rounded-xl overflow-hidden border border-[#E7E5E4] bg-stone-50 aspect-square max-w-[220px] p-2 flex items-center justify-center shadow-sm cursor-pointer"
                  >
                    <img
                      src={androidLogoImage || defaultAndroidLogo}
                      alt="Instant App Logo Preview"
                      className="w-full h-full object-contain"
                    />
                    {isUploadingAndroid && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs font-medium">
                        Uploading...
                      </div>
                    )}
                  </div>

                  <div className="text-[11px] text-stone-500 flex items-center gap-2">
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${androidLogoImage ? "bg-emerald-500" : "bg-stone-400"}`} />
                    <span>512 × 512 px • PNG • {androidLogoImage ? "Active" : "Default"}</span>
                  </div>
                </div>

                {/* Right Column: Android Mockup */}
                <div className="lg:col-span-6 bg-[#FAF7F6] rounded-xl p-6 flex flex-col items-center justify-center border border-[#ECE8E6]">
                  <div className="mb-4 text-center">
                    <span className="block text-[11px] uppercase tracking-wider text-stone-400 font-medium">
                      Android app preview
                    </span>
                    <span className="block text-[10px] text-stone-400 mt-0.5">
                      This shows how your image may appear to customers.
                    </span>
                  </div>

                  <div className="w-[280px] sm:w-[300px] h-[550px] bg-white rounded-[32px] p-2 shadow-2xl relative border-[3px] border-stone-300 flex flex-col">
                    <div className="pt-2 px-5 flex items-center justify-between text-[11px] font-medium text-stone-600">
                      <span>12:30</span>
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                          <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L12 22l7.03-4.39C20.26 16.07 21 14.12 21 12c0-4.97-4.03-9-9-9z" />
                        </svg>
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                          <path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z" />
                        </svg>
                      </div>
                    </div>

                    {/* Centered Brand Launch Area */}
                    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
                      <div className="w-24 h-24 rounded-2xl overflow-hidden mb-4 border border-stone-100 p-1 bg-stone-50 flex items-center justify-center">
                        <img
                          src={androidLogoImage || defaultAndroidLogo}
                          alt="Logo"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <h4 className="text-sm font-semibold text-neutral-800">
                        {orgName}
                      </h4>

                      <div className="w-36 h-1 bg-stone-100 rounded-full mt-6 overflow-hidden">
                        <div className="w-1/2 h-full bg-emerald-600 rounded-full animate-pulse" />
                      </div>
                    </div>

                    <div className="py-4 text-center border-t border-stone-100">
                      <span className="text-[10px] text-stone-400 font-medium tracking-wide">
                        Google Play <span className="text-emerald-700 font-semibold">Instant</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ================================================== */}
        {/* ACCORDION SECTION 3: PDF DOCUMENTS                 */}
        {/* ================================================== */}
        <div className="border border-[#E7E5E4] rounded-xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => toggleAccordion("pdf")}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-stone-50/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${pdfLogoImage ? "bg-emerald-500" : "bg-stone-300"}`} />
              <h3 className="font-serif text-[22px] font-normal text-[#141010]">
                PDF documents
              </h3>
            </div>
            <svg
              className={`w-5 h-5 text-stone-500 transform transition-transform duration-200 ${
                openSection === "pdf" ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
            </svg>
          </button>

          {openSection === "pdf" && (
            <div className="px-6 pb-8 pt-2 border-t border-[#F0EEED] space-y-6 block">
              <p className="text-xs text-[#5E5E5E] max-w-2xl leading-relaxed">
                Choose the logo that will appear on your restaurant's PDF documents.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-800">
                    Document logo
                  </label>
                  <p className="text-xs text-[#5E5E5E] mt-1">
                    Add the restaurant logo you want to show on printed or downloaded documents.
                  </p>
                </div>

                {pdfLogoImage ? (
                  <div className="border border-stone-200 rounded-xl p-6 bg-white max-w-2xl flex items-center justify-between shadow-xs">
                    <div className="flex items-center space-x-4">
                      <div className="w-24 h-16 rounded-lg border border-stone-100 bg-stone-50 p-2 flex items-center justify-center overflow-hidden">
                        <img src={pdfLogoImage} alt="PDF Logo" className="max-h-full max-w-full object-contain" />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-neutral-800 block">Document Logo</span>
                        <span className="text-[11px] text-stone-500 block mt-0.5">Active on printed receipts & invoices</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => pdfFileInputRef.current?.click()}
                        disabled={isUploadingPdf}
                        className="px-3 py-1.5 border border-stone-300 rounded-md text-xs font-medium text-stone-700 hover:bg-stone-50 transition"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={handleRemovePdfImage}
                        className="px-3 py-1.5 border border-red-200 rounded-md text-xs font-medium text-red-600 hover:bg-red-50 transition"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Empty State Upload Dropzone */
                  <div
                    onClick={() => pdfFileInputRef.current?.click()}
                    className="border-2 border-dashed border-stone-200 rounded-xl p-10 flex flex-col items-center justify-center bg-stone-50/50 hover:bg-stone-50 hover:border-stone-300 transition-all cursor-pointer group max-w-2xl"
                  >
                    <div className="w-14 h-14 rounded-full bg-white shadow-sm flex items-center justify-center text-stone-400 group-hover:text-black group-hover:scale-105 transition-all mb-3 border border-stone-100">
                      <svg className="w-6 h-6 stroke-current" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-stone-700 group-hover:text-black">
                      No logo added yet.
                    </span>
                    <p className="text-xs text-stone-500 mt-1">
                      Drop your invoice logo here, or click to browse
                    </p>
                    <span className="text-[11px] text-stone-400 mt-3 font-light">
                      Monochrome or high-contrast PNG, 600×200 px. Transparent background recommended.
                    </span>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => pdfFileInputRef.current?.click()}
                    disabled={isUploadingPdf}
                    className="inline-flex items-center gap-2 border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 px-4 py-2 rounded-lg text-xs font-medium transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <svg className="w-3.5 h-3.5 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                    <span>{pdfLogoImage ? "Change Logo" : "Add Logo"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
