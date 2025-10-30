import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    // Validate input
    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    // Get the upload password from environment variables
    const uploadPassword = process.env.UPLOAD_PASSWORD;

    if (!uploadPassword) {
      console.error("UPLOAD_PASSWORD environment variable is not set");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Check if the password matches
    const isValid = password === uploadPassword;

    if (isValid) {
      return NextResponse.json({
        success: true,
        message: "Password validated successfully",
      });
    } else {
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("Password validation error:", error);
    return NextResponse.json(
      { error: "Validation failed" },
      { status: 500 }
    );
  }
}
