#version 450
layout (set = 1, binding = 0) uniform sampler2D albedoMap;
layout (set = 1, binding = 1) uniform sampler2D normalMap;
layout (set = 1, binding = 2) uniform sampler2D aoMap;
layout (set = 1, binding = 3) uniform sampler2D metallicRoughnessMap;
layout (set = 1, binding = 4) uniform sampler2D emissiveMap;

layout (set = 3, binding = 0) uniform  UBO 
{
	mat4 lightViewProjection;
} ubo;

layout (set = 3, binding = 1) uniform sampler2D shadowMap;



layout (location = 0) in vec3 inNormal;
layout (location = 1) in vec3 inColor;
layout (location = 2) in vec2 inUV;
layout (location = 3) in vec3 inViewVec;
layout (location = 4) in vec3 inLightVec;

layout (location = 5) flat in uint inNodeIndex;
layout (location = 6) in vec4 inTangent;
layout (location = 7) in vec4 inPos;

layout (location = 0) out vec4 outFragColor;


const float PI = 3.14159265359;

vec3 materialcolor()
{
	return texture(albedoMap, inUV).rgb;
}

float DistributionGGX(vec3 N, vec3 H, float roughness)
{
    float a = roughness*roughness;
    float a2 = a*a;
    float NdotH = max(dot(N, H), 0.0);
    float NdotH2 = NdotH*NdotH;

    float nom   = a2;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;

    return nom / denom;
}

float GeometrySchlickGGX(float NdotV, float roughness)
{
    float r = (roughness + 1.0);
    float k = (r*r) / 8.0;

    float nom   = NdotV;
    float denom = NdotV * (1.0 - k) + k;

    return nom / denom;
}

float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness)
{
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float ggx2 = GeometrySchlickGGX(NdotV, roughness);
    float ggx1 = GeometrySchlickGGX(NdotL, roughness);

    return ggx1 * ggx2;
}

vec3 fresnelSchlick(float cosTheta, vec3 F0)
{
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

vec3 calculateNormal()
{
	vec3 tangentNormal = texture(normalMap, inUV).xyz * 2.0 - 1.0;

	vec3 N = normalize(inNormal);
	vec3 T = normalize(inTangent.xyz);
	vec3 B = normalize(cross(N, T));
	mat3 TBN = mat3(T, B, N);
	return normalize(TBN * tangentNormal);
}

void main()
{		  
	vec3 N = calculateNormal();
	vec3 V = normalize(inViewVec);
	vec3 L = normalize(inLightVec);
	vec3 H = normalize(V + L);

	float metallic = texture(metallicRoughnessMap, inUV).r;
	float roughness = texture(metallicRoughnessMap, inUV).g;
	vec3 albedo = texture(albedoMap, inUV).rgb;
	float ao = texture(aoMap, inUV).r;
	vec3 emissive = texture(emissiveMap, inUV).rgb;

	vec3 F0 = vec3(0.04);
	F0 = mix(F0, albedo, metallic);

	//radiance
	vec3 radiance = vec3(1.0 / (length(inLightVec) * length(inLightVec)));
	//因为是directional light，干脆写死了。
	radiance = vec3(1.0);

	//Cook-Torrance
    float NDF = DistributionGGX(N, H, roughness);   
    float G   = GeometrySmith(N, V, L, roughness);      
    vec3 F    = fresnelSchlick(max(dot(H, V), 0.0), F0);

	//specular
	vec3 specular = NDF * G * F / (4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001);

	//diffuse
	vec3 kD = (1.0 - metallic) * (1.0 - F);
	vec3 diffuse = kD * albedo / PI;

	//combination
	vec3 color = (specular + diffuse) * radiance * max(dot(N, L), 0.0);

	//ambient
	vec3 ambient = vec3(0.03) * albedo * ao;
	color += ambient;

	//emissive
	color += emissive;

	//Tone mapping
	color = color / (color + vec3(1.0));

	// Gamma correct
	color = pow(color, vec3(0.4545));
	
	outFragColor = vec4(color, texture(albedoMap, inUV).a);
}