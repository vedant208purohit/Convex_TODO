"use client";

import { useState, useEffect, useRef, ChangeEvent } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

type DigitalStoreTab = "general" | "carousel" | "about" | "social" | "policies";

export function OrganizationDigitalStore() {
  const organizations = useQuery(api.organizations.list);
  const org = organizations?.[0] ?? null;
  const isLoading = organizations === undefined;

  const updateOrg = useMutation(api.organizations.update);
  const createAssetUpload = useAction(api.r2.createAssetUpload);
  const confirmAssetUpload = useAction(api.r2.confirmAssetUpload);

  // Organization Carousel Screens Query & Mutations
  const carouselScreens = useQuery(
    api.organizationCarouselScreens.list,
    org?._id ? {} : "skip",
  );
  const createCarouselScreen = useMutation(
    api.organizationCarouselScreens.create,
  );
  const removeCarouselScreen = useMutation(
    api.organizationCarouselScreens.remove,
  );
  const generateUploadUrl = useMutation(
    api.organizations.generateUploadUrl,
  );

  // About Us Gallery Images Query & Mutations (Convex Database)
  const aboutUsGalleryDocs = useQuery(
    api.digitalStoreImages.listStorefrontImages,
    { imageType: "about_us_image" },
  );
  const createGalleryImage = useMutation(
    api.digitalStoreImages.createDigitalStoreImage,
  );
  const removeGalleryImage = useMutation(
    api.digitalStoreImages.removeDigitalStoreImage,
  );

  // Active Tab State
  const [activeTab, setActiveTab] = useState<DigitalStoreTab>("general");

  // Form State
  const [digitalStoreStatus, setDigitalStoreStatus] = useState(true);
  const [aboutUsContent, setAboutUsContent] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [privacyPolicy, setPrivacyPolicy] = useState("");
  const [refundPolicy, setRefundPolicy] = useState("");
  const [termsPolicy, setTermsPolicy] = useState("");

  // About Us Main Image & Gallery State
  const [aboutUsAssetId, setAboutUsAssetId] = useState<string>("");
  const [aboutUsPreviewUrl, setAboutUsPreviewUrl] = useState<string>("");
  const [aboutUsGalleryImages, setAboutUsGalleryImages] = useState<any[]>([]);
  const [isUploadingAboutUs, setIsUploadingAboutUs] = useState(false);

  // Carousel & Gallery Uploading State
  const [isUploadingCarousel, setIsUploadingCarousel] = useState(false);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);

  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // File Inputs Refs
  const aboutUsFileRef = useRef<HTMLInputElement>(null);
  const carouselFileRef = useRef<HTMLInputElement>(null);
  const galleryFileRef = useRef<HTMLInputElement>(null);

  // Digital Store Settings Query (resolves storage URLs dynamically)
  const digitalStoreData = useQuery(
    api.organizations.getDigitalStore,
    org?._id ? { id: org._id } : "skip",
  );

  // Sync state when org data loads/changes
  useEffect(() => {
    if (!org) return;
    setDigitalStoreStatus(org.digitalStoreStatus ?? true);
    setAboutUsContent((org as any).aboutUsContent || "");
    setFacebookUrl((org as any).facebookAccountLink || "");
    setInstagramUrl((org as any).instagramAccountLink || "");
    setPrivacyPolicy((org as any).policyLink || "");
    setRefundPolicy((org as any).refundLink || "");
    setTermsPolicy((org as any).termAndConditionLink || "");
  }, [org]);

  // Sync resolved aboutUsImageUrl from backend query
  useEffect(() => {
    if (digitalStoreData?.aboutUsImageUrl) {
      setAboutUsPreviewUrl(digitalStoreData.aboutUsImageUrl);
    }
  }, [digitalStoreData?.aboutUsImageUrl]);

  // Show Toast Feedback
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Handle Main Save Button
  const handleSave = async () => {
    if (!org?._id) return;
    setIsSaving(true);
    setErrorMessage(null);

    try {
      await updateOrg({
        id: org._id,
        digitalStoreStatus,
        onlineStore: digitalStoreStatus,
        aboutUsContent,
        facebookAccountLink: facebookUrl,
        instagramAccountLink: instagramUrl,
        policyLink: privacyPolicy,
        refundLink: refundPolicy,
        termAndConditionLink: termsPolicy,
        aboutUsImageUrl:
          aboutUsPreviewUrl && !aboutUsPreviewUrl.startsWith("blob:")
            ? aboutUsPreviewUrl
            : undefined,
      });

      showToast("Digital store settings saved successfully");
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to save digital store settings.");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Cancel Button (Reverts to stored state)
  const handleCancel = () => {
    if (!org) return;
    setDigitalStoreStatus(org.digitalStoreStatus ?? true);
    setAboutUsContent((org as any).aboutUsContent || "");
    setFacebookUrl((org as any).facebookAccountLink || "");
    setInstagramUrl((org as any).instagramAccountLink || "");
    setPrivacyPolicy((org as any).policyLink || "");
    setRefundPolicy((org as any).refundLink || "");
    setTermsPolicy((org as any).termAndConditionLink || "");
    setAboutUsPreviewUrl((org as any).aboutUsImageUrl || "");
    showToast("Changes reverted to previous state");
  };

  // Format Error Message for R2 / Convex Errors
  const formatErrorMessage = (err: any) => {
    const msg = err?.message || String(err);
    if (msg.includes("Missing required Cloudflare R2 environment variables")) {
      return "Cloudflare R2 storage credentials are not configured in your Convex deployment environment (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME). Please configure them in Convex Dashboard.";
    }
    return msg;
  };

  // About Us Main Flagship Image Upload Handler
  const handleAboutUsUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !org?._id) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Image size exceeds 5MB limit.");
      return;
    }

    setIsUploadingAboutUs(true);
    setErrorMessage(null);

    try {
      // 1. Primary Convex Storage Upload (guarantees direct viewable storageId URL)
      const postUrl = await generateUploadUrl();
      const postResult = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "image/jpeg" },
        body: file,
      });

      if (!postResult.ok) {
        throw new Error(`Upload failed with status ${postResult.status}`);
      }

      const resJson = await postResult.json();
      const storageId: Id<"_storage"> = resJson.storageId;

      if (!storageId) {
        throw new Error("Upload did not return a valid Convex storage ID.");
      }

      // 2. Persist permanent storageId in Convex Database
      await updateOrg({
        id: org._id,
        aboutUsImageStorageId: storageId,
      });

      // 3. Secondary Cloudflare R2 Upload (optional pass)
      try {
        const uploadResult = await createAssetUpload({
          assetType: "about_us_image",
          fileName: file.name,
          contentType: file.type || "image/jpeg",
          fileSize: file.size,
          organizationId: org._id,
        });

        const putResult = await fetch(uploadResult.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "image/jpeg" },
          body: file,
        });

        if (putResult.ok) {
          await confirmAssetUpload({ assetId: uploadResult.assetId });
        }
      } catch (r2Err) {
        console.warn("R2 upload optional pass skipped:", r2Err);
      }

      const localPreviewUrl = URL.createObjectURL(file);
      setAboutUsPreviewUrl(localPreviewUrl);

      showToast("About Us main image updated successfully");
    } catch (err: any) {
      setErrorMessage(formatErrorMessage(err));
    } finally {
      setIsUploadingAboutUs(false);
      if (aboutUsFileRef.current) aboutUsFileRef.current.value = "";
    }
  };

  // Remove About Us Main Flagship Image
  const handleRemoveAboutUsImage = async () => {
    if (!org?._id) return;
    setAboutUsAssetId("");
    setAboutUsPreviewUrl("");
    await updateOrg({
      id: org._id,
      aboutUsImageUrl: "",
      aboutUsImageStorageId: undefined,
    });
    showToast("About Us image removed");
  };

  // Carousel Image Upload Handler (using organizationCarouselScreens)
  const handleCarouselUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !org?._id) return;

    setIsUploadingCarousel(true);
    setErrorMessage(null);

    try {
      let storageId: Id<"_storage"> | undefined = undefined;
      let assetId: Id<"organization_assets"> | undefined = undefined;

      // 1. Primary Convex Storage Upload (guarantees direct viewable storageId URL)
      try {
        const postUrl = await generateUploadUrl();
        const postResult = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": file.type || "image/jpeg" },
          body: file,
        });

        if (postResult.ok) {
          const resJson = await postResult.json();
          storageId = resJson.storageId;
        }
      } catch (storageErr) {
        console.warn("Convex storage upload error:", storageErr);
      }

      // 2. Secondary Cloudflare R2 Upload
      try {
        const uploadResult = await createAssetUpload({
          assetType: "carousel_image",
          fileName: file.name,
          contentType: file.type || "image/jpeg",
          fileSize: file.size,
          organizationId: org._id,
        });

        const putResult = await fetch(uploadResult.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "image/jpeg" },
          body: file,
        });

        if (putResult.ok) {
          await confirmAssetUpload({ assetId: uploadResult.assetId });
          assetId = uploadResult.assetId;
        }
      } catch (r2Err) {
        console.warn("R2 upload optional pass skipped:", r2Err);
      }

      if (!storageId && !assetId) {
        throw new Error("Failed to upload carousel image. Please try again.");
      }

      await createCarouselScreen({
        storageId,
        assetId,
        fileName: file.name,
      });

      showToast("Carousel image added successfully");
    } catch (err: any) {
      setErrorMessage(formatErrorMessage(err));
    } finally {
      setIsUploadingCarousel(false);
      if (carouselFileRef.current) carouselFileRef.current.value = "";
    }
  };

  // Remove Carousel Slide
  const handleRemoveCarouselSlide = async (
    imageId: Id<"organizationCarouselScreens">,
  ) => {
    try {
      await removeCarouselScreen({ id: imageId });
      showToast("Carousel image removed");
    } catch (err: any) {
      setErrorMessage(formatErrorMessage(err));
    }
  };

  // About Us Gallery Photo Upload Handler (using digitalStoreImages in Convex DB)
  const handleGalleryUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !org?._id) return;

    setIsUploadingGallery(true);
    setErrorMessage(null);

    try {
      let storageId: Id<"_storage"> | undefined = undefined;
      let assetId: Id<"organization_assets"> | undefined = undefined;

      // 1. Primary Convex Storage Upload (guarantees direct viewable storageId URL)
      try {
        const postUrl = await generateUploadUrl();
        const postResult = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": file.type || "image/jpeg" },
          body: file,
        });

        if (postResult.ok) {
          const resJson = await postResult.json();
          storageId = resJson.storageId;
        }
      } catch (storageErr) {
        console.warn("Convex storage upload error:", storageErr);
      }

      // 2. Secondary Cloudflare R2 Upload
      try {
        const uploadResult = await createAssetUpload({
          assetType: "about_us_image",
          fileName: file.name,
          contentType: file.type || "image/jpeg",
          fileSize: file.size,
          organizationId: org._id,
        });

        const putResult = await fetch(uploadResult.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "image/jpeg" },
          body: file,
        });

        if (putResult.ok) {
          await confirmAssetUpload({ assetId: uploadResult.assetId });
          assetId = uploadResult.assetId;
        }
      } catch (r2Err) {
        console.warn("R2 upload optional pass skipped:", r2Err);
      }

      if (!storageId && !assetId) {
        throw new Error("Failed to upload gallery photo. Please try again.");
      }

      await createGalleryImage({
        storageId,
        assetId,
        imageType: "about_us_image",
      });

      showToast("Gallery photo added successfully");
    } catch (err: any) {
      setErrorMessage(formatErrorMessage(err));
    } finally {
      setIsUploadingGallery(false);
      if (galleryFileRef.current) galleryFileRef.current.value = "";
    }
  };

  // Remove About Us Gallery Photo
  const handleRemoveGalleryPhoto = async (
    imageId: Id<"digitalStoreImages">,
  ) => {
    try {
      await removeGalleryImage({ id: imageId });
      showToast("Gallery photo removed");
    } catch (err: any) {
      setErrorMessage(formatErrorMessage(err));
    }
  };

  if (isLoading) {
    return (
      <div className="py-16 text-center">
        <div className="w-8 h-8 mx-auto border-2 border-[#0c0a09] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium text-stone-500">
          Loading Digital Store Settings...
        </p>
      </div>
    );
  }

  const storeWebUrl = `https://${org?.slug || "skyzrestaurant"}.prest.store`;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#fdf8f7] overflow-hidden select-none">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={aboutUsFileRef}
        onChange={handleAboutUsUpload}
        accept="image/jpeg,image/png"
        className="hidden"
      />
      <input
        type="file"
        ref={carouselFileRef}
        onChange={handleCarouselUpload}
        accept="image/jpeg,image/png"
        className="hidden"
      />
      <input
        type="file"
        ref={galleryFileRef}
        onChange={handleGalleryUpload}
        accept="image/jpeg,image/png"
        className="hidden"
      />

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto max-w-5xl w-full">
        {/* Header & Primary CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#e7e5e4] mb-6">
          <div>
            <h1 className="font-serif text-[30px] font-normal leading-tight text-[#141010]">
              Digital store
            </h1>
            <p className="text-sm text-[#5e5e5e] mt-1 font-sans">
              Manage what customers see on your restaurant's online store.
            </p>
          </div>
          <div>
            <a
              href={storeWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 px-4 py-2 bg-[#0c0a09] hover:bg-stone-800 text-white rounded-md text-xs font-medium tracking-wide shadow-xs transition-colors"
            >
              <span>Visit digital store</span>
              <span className="text-stone-300 text-[11px]">↗</span>
            </a>
          </div>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center justify-between">
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-500 hover:text-red-800 font-bold ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* Horizontal Tab Bar */}
        <div className="border-b border-[#e7e5e4] mb-8">
          <nav
            aria-label="Digital Store Tabs"
            className="flex space-x-8 -mb-px"
            id="tabBar"
          >
            <button
              type="button"
              onClick={() => setActiveTab("general")}
              className={`py-3 px-1 border-b-2 text-sm font-medium focus:outline-none transition-colors ${
                activeTab === "general"
                  ? "text-[#0c0a09] border-[#0c0a09] font-medium"
                  : "text-[#5e5e5e] border-transparent hover:text-[#141010]"
              }`}
            >
              General
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("carousel")}
              className={`py-3 px-1 border-b-2 text-sm font-medium focus:outline-none transition-colors ${
                activeTab === "carousel"
                  ? "text-[#0c0a09] border-[#0c0a09] font-medium"
                  : "text-[#5e5e5e] border-transparent hover:text-[#141010]"
              }`}
            >
              Carousel Images
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("about")}
              className={`py-3 px-1 border-b-2 text-sm font-medium focus:outline-none transition-colors ${
                activeTab === "about"
                  ? "text-[#0c0a09] border-[#0c0a09] font-medium"
                  : "text-[#5e5e5e] border-transparent hover:text-[#141010]"
              }`}
            >
              About Us
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("social")}
              className={`py-3 px-1 border-b-2 text-sm font-medium focus:outline-none transition-colors ${
                activeTab === "social"
                  ? "text-[#0c0a09] border-[#0c0a09] font-medium"
                  : "text-[#5e5e5e] border-transparent hover:text-[#141010]"
              }`}
            >
              Social Links
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("policies")}
              className={`py-3 px-1 border-b-2 text-sm font-medium focus:outline-none transition-colors ${
                activeTab === "policies"
                  ? "text-[#0c0a09] border-[#0c0a09] font-medium"
                  : "text-[#5e5e5e] border-transparent hover:text-[#141010]"
              }`}
            >
              Policies
            </button>
          </nav>
        </div>

        {/* TAB PANELS CONTAINER */}
        <form onSubmit={(e) => e.preventDefault()}>
          {/* TAB 1: General */}
          {activeTab === "general" && (
            <section className="space-y-6">
              <div className="bg-white border border-[#e7e5e4] rounded-lg p-6 shadow-xs">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 pr-6 max-w-xl">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-sm font-semibold text-[#141010]">
                        Digital store status
                      </h3>
                      {digitalStoreStatus ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
                          Store is live
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-stone-100 text-stone-600 border border-stone-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-stone-400 mr-1.5" />
                          Store is off
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#5e5e5e] leading-relaxed pt-1">
                      Turn your online store on or off for customers. When
                      turned on, customers can visit your website, view your
                      menu, and place orders.
                    </p>
                  </div>
                  <div className="shrink-0 pt-0.5">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={digitalStoreStatus}
                        onChange={(e) =>
                          setDigitalStoreStatus(e.target.checked)
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0c0a09]" />
                    </label>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* TAB 2: Carousel Images */}
          {activeTab === "carousel" && (
            <section className="space-y-6">
              <div className="bg-white border border-[#e7e5e4] rounded-lg p-6 shadow-xs space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-[#141010]">
                    Carousel Images
                  </h3>
                  <p className="text-xs text-[#5e5e5e] mt-0.5">
                    Add the large images customers see at the top of your online
                    store. Use these images to highlight special offers, popular
                    dishes or seasonal promotions.
                  </p>
                  <div className="mt-2 inline-flex items-center text-[11px] text-stone-500 bg-stone-50 border border-[#e7e5e4]/70 px-2.5 py-1 rounded">
                    <span>
                      Note: 1440 × 1080px JPEG/PNG images recommended. Add up to
                      5 images.
                    </span>
                  </div>
                </div>

                {/* Carousel Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                  {carouselScreens && carouselScreens.length > 0 &&
                    carouselScreens.map((screen: any, idx: number) => (
                      <div
                        key={screen._id}
                        className="relative group border border-[#e7e5e4] rounded-lg overflow-hidden bg-[#fdf8f7]"
                      >
                        <div className="absolute top-2.5 left-2.5 z-10 bg-[#0c0a09]/80 text-white text-[10px] font-mono px-2 py-0.5 rounded backdrop-blur-xs">
                          Pos {idx + 1}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleRemoveCarouselSlide(
                              screen._id as Id<"organizationCarouselScreens">,
                            )
                          }
                          className="absolute top-2.5 right-2.5 z-10 w-6 h-6 rounded-full bg-black/60 hover:bg-red-600 text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
                          title="Remove image"
                        >
                          ✕
                        </button>
                        <div className="h-44 w-full bg-stone-100 flex items-center justify-center relative overflow-hidden">
                          {screen.imageUrl ? (
                            <img
                              src={screen.imageUrl}
                              alt={screen.fileName || `Slide ${idx + 1}`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="text-center p-4 text-stone-500 flex flex-col items-center justify-center">
                              <svg className="w-8 h-8 text-stone-400 mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 002-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="text-xs text-stone-600 font-medium truncate max-w-[160px]">
                                {screen.fileName || `Carousel Slide ${idx + 1}`}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="p-3 bg-white flex items-center justify-between border-t border-[#e7e5e4] text-xs">
                          <span className="text-[#5e5e5e] text-[11px] truncate max-w-[150px]">
                            {screen.fileName || `Slide ${idx + 1}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => carouselFileRef.current?.click()}
                            className="text-[#0c0a09] font-medium hover:underline text-[12px] cursor-pointer"
                          >
                            Change
                          </button>
                        </div>
                      </div>
                    ))}

                  {/* Upload CTA Card */}
                  <div
                    onClick={() => carouselFileRef.current?.click()}
                    className="border-2 border-dashed border-[#e7e5e4] hover:border-stone-400 rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-stone-50/50 hover:bg-stone-50 min-h-[190px]"
                  >
                    <div className="w-10 h-10 rounded-full bg-stone-200/80 text-[#0c0a09] flex items-center justify-center mb-2">
                      <span className="text-lg font-medium">
                        {isUploadingCarousel ? "..." : "+"}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-[#141010]">
                      {isUploadingCarousel
                        ? "Uploading..."
                        : "Add New Carousel Image"}
                    </p>
                    <p className="text-[11px] text-[#5e5e5e] mt-1">
                      Drag and drop or browse file
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* TAB 3: About Us */}
          {activeTab === "about" && (
            <section className="space-y-6">
              {/* Section A: Main Photo */}
              <div className="bg-white border border-[#e7e5e4] rounded-lg p-6 shadow-xs space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-[#141010]">
                    About us image
                  </h3>
                  <p className="text-xs text-[#5e5e5e] mt-0.5">
                    Add the main photo customers will see in your About Us
                    section (400×400px JPEG/PNG recommended).
                  </p>
                </div>
                <div className="flex items-start space-x-5">
                  <div className="relative w-36 h-36 rounded-lg border border-[#e7e5e4] bg-stone-100 flex items-center justify-center overflow-hidden shrink-0 group shadow-xs">
                    {aboutUsPreviewUrl ? (
                      <>
                        <div className="absolute top-2 left-2 z-10 bg-[#0c0a09]/80 text-white text-[9px] font-mono px-2 py-0.5 rounded backdrop-blur-xs">
                          Main Photo
                        </div>
                        <img
                          src={aboutUsPreviewUrl}
                          alt="About Us Flagship Photo"
                          className="w-full h-full object-cover"
                        />
                      </>
                    ) : (
                      <div className="text-center p-2 flex flex-col items-center justify-center text-stone-400">
                        <svg className="w-10 h-10 mb-1.5 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs text-stone-500 font-medium">
                          Upload Main Photo
                        </span>
                      </div>
                    )}
                    {aboutUsPreviewUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveAboutUsImage}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 hover:bg-red-600 text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
                        title="Remove image"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col justify-center space-y-2 pt-3">
                    <button
                      type="button"
                      onClick={() => aboutUsFileRef.current?.click()}
                      disabled={isUploadingAboutUs}
                      className="px-4 py-2 text-xs font-medium border border-[#e7e5e4] rounded-md hover:bg-stone-50 text-[#141010] inline-flex items-center space-x-1.5 self-start transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                    >
                      <span>
                        {isUploadingAboutUs ? "Uploading..." : "Change Image"}
                      </span>
                    </button>
                    <span className="text-[11px] text-[#5e5e5e]">
                      Supported formats: JPG, PNG. Max size: 5MB.
                    </span>
                  </div>
                </div>
              </div>

              {/* Section B: Restaurant Story */}
              <div className="bg-white border border-[#e7e5e4] rounded-lg p-6 shadow-xs space-y-3">
                <div>
                  <label
                    htmlFor="aboutContent"
                    className="text-sm font-semibold text-[#141010] block"
                  >
                    About us content
                  </label>
                  <p className="text-xs text-[#5e5e5e] mt-0.5">
                    Write a short story about your restaurant, culinary
                    philosophy or your dedicated kitchen team.
                  </p>
                </div>
                <div>
                  <textarea
                    id="aboutContent"
                    rows={4}
                    value={aboutUsContent}
                    onChange={(e) => setAboutUsContent(e.target.value)}
                    placeholder="Share your culinary heritage, artisanal philosophy and ingredients..."
                    className="w-full text-xs font-sans rounded-md border-[#e7e5e4] focus:border-[#0c0a09] focus:ring-[#0c0a09]/10 transition-colors p-3.5 text-[#141010]"
                  />
                </div>
              </div>

              {/* Section C: Photo Gallery (about_us_image) */}
              <div className="bg-white border border-[#e7e5e4] rounded-lg p-6 shadow-xs space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-[#141010]">
                    More photos (About Us Gallery)
                  </h3>
                  <p className="text-xs text-[#5e5e5e] mt-0.5">
                    Add photos that showcase your dining room atmosphere,
                    artisanal cocktails, kitchen prep, and team.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
                  {aboutUsGalleryDocs && aboutUsGalleryDocs.length > 0 &&
                    aboutUsGalleryDocs.map((photo: any, idx: number) => (
                      <div
                        key={photo._id}
                        className="relative group border border-[#e7e5e4] rounded-lg overflow-hidden bg-stone-100 shadow-xs flex flex-col"
                      >
                        <div className="absolute top-2.5 left-2.5 z-10 bg-[#0c0a09]/80 text-white text-[10px] font-mono px-2 py-0.5 rounded backdrop-blur-xs">
                          Photo {idx + 1}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleRemoveGalleryPhoto(
                              photo._id as Id<"digitalStoreImages">,
                            )
                          }
                          className="absolute top-2.5 right-2.5 z-10 w-6 h-6 rounded-full bg-black/60 hover:bg-red-600 text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
                          title="Remove photo"
                        >
                          ✕
                        </button>
                        <div className="h-36 w-full bg-stone-100 flex items-center justify-center relative overflow-hidden">
                          {photo.imageUrl ? (
                            <img
                              src={photo.imageUrl}
                              alt={photo.fileName || `Gallery Photo ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="text-center p-3 text-stone-500 flex flex-col items-center justify-center">
                              <svg className="w-7 h-7 text-stone-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="text-[11px] font-medium text-stone-600 truncate max-w-[140px]">
                                {photo.fileName || `Photo ${idx + 1}`}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="p-2.5 bg-white border-t border-[#e7e5e4] flex items-center justify-between text-xs">
                          <span className="text-[#5e5e5e] text-[11px] font-medium truncate max-w-[180px]">
                            {photo.fileName || `Gallery Photo ${idx + 1}`}
                          </span>
                        </div>
                      </div>
                    ))}

                  <div
                    onClick={() => galleryFileRef.current?.click()}
                    className="border-2 border-dashed border-[#e7e5e4] hover:border-stone-400 rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-stone-50/50 hover:bg-stone-50 min-h-[160px]"
                  >
                    <div className="w-8 h-8 rounded-full bg-stone-200/80 text-[#0c0a09] flex items-center justify-center mb-1.5">
                      <span className="text-base font-medium">
                        {isUploadingGallery ? "Uploading..." : "+"}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-[#141010]">
                      {isUploadingGallery ? "Uploading..." : "Add Photo to Gallery"}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* TAB 4: Social Links */}
          {activeTab === "social" && (
            <section className="space-y-6">
              <div className="bg-white border border-[#e7e5e4] rounded-lg p-6 shadow-xs space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-[#141010]">
                    Social Links
                  </h3>
                  <p className="text-xs text-[#5e5e5e] mt-0.5">
                    Add your restaurant's official social media handles so
                    guests can discover your community and events.
                  </p>
                </div>
                <div className="space-y-4 max-w-xl">
                  {/* Facebook Input */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="facebookUrl"
                      className="text-xs font-semibold text-[#141010] flex items-center space-x-1.5"
                    >
                      <span>Facebook account link</span>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400 text-xs">
                        🌐
                      </span>
                      <input
                        id="facebookUrl"
                        type="url"
                        value={facebookUrl}
                        onChange={(e) => setFacebookUrl(e.target.value)}
                        placeholder="Ex: https://www.facebook.com/yourrestaurant"
                        className="w-full pl-9 text-xs rounded-md border-[#e7e5e4] focus:border-[#0c0a09] focus:ring-[#0c0a09]/10 transition-colors py-2.5 text-[#141010]"
                      />
                    </div>
                    <p className="text-[11px] text-[#5e5e5e]">
                      Paste your complete public page link.
                    </p>
                  </div>

                  {/* Instagram Input */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="instagramUrl"
                      className="text-xs font-semibold text-[#141010] flex items-center space-x-1.5"
                    >
                      <span>Instagram account link</span>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400 text-xs">
                        📷
                      </span>
                      <input
                        id="instagramUrl"
                        type="url"
                        value={instagramUrl}
                        onChange={(e) => setInstagramUrl(e.target.value)}
                        placeholder="Ex: https://www.instagram.com/yourrestaurant"
                        className="w-full pl-9 text-xs rounded-md border-[#e7e5e4] focus:border-[#0c0a09] focus:ring-[#0c0a09]/10 transition-colors py-2.5 text-[#141010]"
                      />
                    </div>
                    <p className="text-[11px] text-[#5e5e5e]">
                      Enter direct URL to your Instagram profile.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* TAB 5: Policies */}
          {activeTab === "policies" && (
            <section className="space-y-6">
              <div className="bg-white border border-[#e7e5e4] rounded-lg p-6 shadow-xs space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-[#141010]">
                    Store Policies
                  </h3>
                  <p className="text-xs text-[#5e5e5e] mt-0.5">
                    Add clear links to your customer policies to build customer
                    trust and comply with digital payments.
                  </p>
                </div>
                <div className="space-y-4 max-w-xl">
                  {/* Privacy Policy */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="privacyPolicy"
                      className="text-xs font-semibold text-[#141010]"
                    >
                      Privacy policy
                    </label>
                    <input
                      id="privacyPolicy"
                      type="url"
                      value={privacyPolicy}
                      onChange={(e) => setPrivacyPolicy(e.target.value)}
                      placeholder="Enter your privacy policy page link"
                      className="w-full text-xs rounded-md border-[#e7e5e4] focus:border-[#0c0a09] focus:ring-[#0c0a09]/10 transition-colors py-2.5 px-3 text-[#141010]"
                    />
                    <p className="text-[11px] text-[#5e5e5e]">
                      Link where customers can read about data handling and
                      cookies.
                    </p>
                  </div>

                  {/* Refund Policy */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="refundPolicy"
                      className="text-xs font-semibold text-[#141010]"
                    >
                      Refund policy
                    </label>
                    <input
                      id="refundPolicy"
                      type="url"
                      value={refundPolicy}
                      onChange={(e) => setRefundPolicy(e.target.value)}
                      placeholder="Enter your refund policy page link"
                      className="w-full text-xs rounded-md border-[#e7e5e4] focus:border-[#0c0a09] focus:ring-[#0c0a09]/10 transition-colors py-2.5 px-3 text-[#141010]"
                    />
                    <p className="text-[11px] text-[#5e5e5e]">
                      State conditions for order cancellations, delays, or order
                      discrepancies.
                    </p>
                  </div>

                  {/* Terms and condition */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="termsPolicy"
                      className="text-xs font-semibold text-[#141010]"
                    >
                      Terms and condition
                    </label>
                    <input
                      id="termsPolicy"
                      type="url"
                      value={termsPolicy}
                      onChange={(e) => setTermsPolicy(e.target.value)}
                      placeholder="Enter your Terms and condition page link"
                      className="w-full text-xs rounded-md border-[#e7e5e4] focus:border-[#0c0a09] focus:ring-[#0c0a09]/10 transition-colors py-2.5 px-3 text-[#141010]"
                    />
                    <p className="text-[11px] text-[#5e5e5e]">
                      Legal store terms of service governing customer orders.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Sticky / Inline Bottom Action Controls */}
          <div className="pt-8 pb-12 flex items-center space-x-3">
            <button
              type="button"
              onClick={handleCancel}
              className="px-7 py-2.5 bg-stone-200/90 hover:bg-stone-300/80 text-[#141010] rounded-md text-xs font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-8 py-2.5 bg-[#0c0a09] hover:bg-stone-900 text-white rounded-md text-xs font-medium shadow-xs transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              <span>{isSaving ? "Saving..." : "Save"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0c0a09] text-white text-xs px-4 py-3 rounded-lg shadow-xl flex items-center space-x-2.5 border border-stone-700 animate-fadeIn">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
