use serde::Serialize;
use std::sync::OnceLock;

// El orden de las variantes define la prioridad al ordenar la lista
#[cfg_attr(not(any(target_os = "linux", target_os = "windows")), allow(dead_code))]
#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
pub enum GpuKind {
    Discrete,
    Integrated,
    Other,
}

#[cfg_attr(not(any(target_os = "linux", target_os = "windows")), allow(dead_code))]
#[derive(Serialize, Clone, Debug)]
pub struct Gpu {
    pub name: String,
    pub kind: GpuKind,
}

static GPUS: OnceLock<Vec<Gpu>> = OnceLock::new();

pub fn gpus() -> &'static [Gpu] {
    GPUS.get_or_init(list_gpus)
}

#[cfg(any(target_os = "linux", target_os = "windows"))]
fn list_gpus() -> Vec<Gpu> {
    use ash::vk;

    let Ok(entry) = (unsafe { ash::Entry::load() }) else {
        return Vec::new();
    };

    let app_info = vk::ApplicationInfo::default().api_version(vk::API_VERSION_1_0);
    let create_info = vk::InstanceCreateInfo::default().application_info(&app_info);
    let Ok(instance) = (unsafe { entry.create_instance(&create_info, None) }) else {
        return Vec::new();
    };

    let mut gpus: Vec<Gpu> = unsafe { instance.enumerate_physical_devices() }
        .unwrap_or_default()
        .into_iter()
        .filter_map(|device| {
            let props = unsafe { instance.get_physical_device_properties(device) };
            let kind = match props.device_type {
                vk::PhysicalDeviceType::DISCRETE_GPU => GpuKind::Discrete,
                vk::PhysicalDeviceType::INTEGRATED_GPU => GpuKind::Integrated,
                // llvmpipe/lavapipe: Vulkan emulado en el procesador, no es una tarjeta
                vk::PhysicalDeviceType::CPU => return None,
                _ => GpuKind::Other,
            };
            let name = props.device_name_as_c_str().ok()?;
            Some(Gpu {
                name: name.to_string_lossy().into_owned(),
                kind,
            })
        })
        .collect();

    unsafe { instance.destroy_instance(None) };

    gpus.sort_by_key(|gpu| gpu.kind);
    gpus
}

#[cfg(not(any(target_os = "linux", target_os = "windows")))]
fn list_gpus() -> Vec<Gpu> {
    Vec::new()
}
